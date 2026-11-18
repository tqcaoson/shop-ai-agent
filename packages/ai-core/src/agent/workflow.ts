// Workflow của agent — dạng các node của LangGraph, chạy tuần tự:
// INPUT GUARD -> AUTHORIZATION (backend cấp, LLM không được sửa)
// -> INTENT -> RAG node hoặc MCP node -> OUTPUT VALIDATOR -> RESPONSE.
// Intent KHÔNG quyết định authorization: backend kiểm tra lại trước mỗi tool.
import type { AgentState } from "../../../shared-types/src/index.js";
import { inputGuard, outputGuard, refusalNoSource } from "../../../security/src/guardrails.js";
import { classifyIntent } from "./intent.js";
import { SYSTEM_PROMPT, buildOrderPrompt, buildProductPrompt, buildRagPrompt } from "./prompts.js";

export interface AgentContext {
  userId: string;
  roles: string[];
  permissions: string[];
  // Hàm do API cung cấp — agent chỉ gọi, không tự truy cập DB.
  rag: (
    q: string,
  ) => Promise<{ document: string; category: string; content: string; score: number }[]>;
  shop: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
  llm?: (prompt: string) => Promise<string>;
}

/** Trả lời mẫu khi không có LLM: dùng đúng dữ liệu đã có, không bịa thêm. */
function formatProducts(products: { name: string; price: number; id: string }[]): string {
  return products.length
    ? "Mình tìm thấy:\n" +
        products
          .map((p) => `- ${p.name} - ${p.price.toLocaleString("vi-VN")} VND (id: ${p.id})`)
          .join("\n")
    : "Không tìm thấy sản phẩm phù hợp. Bạn thử từ khoá khác nhé.";
}

function formatOrders(
  orders: { order_number: string; status: string; total_amount: number }[],
): string {
  return orders.length
    ? "Đơn hàng của bạn:\n" +
        orders
          .map(
            (o) =>
              `- ${o.order_number}: ${o.status} - ${o.total_amount.toLocaleString("vi-VN")} VND`,
          )
          .join("\n")
    : "Bạn chưa có đơn hàng nào.";
}

/**
 * Dùng LLM để tổng hợp câu trả lời từ dữ liệu thật (chunk RAG hoặc kết quả tool).
 * Nếu LLM trả về rỗng hoặc bị Output Guard chặn, dùng mẫu trả lời cũ.
 */
async function synthesizeWithLlm(
  ctx: AgentContext,
  prompt: string,
  intent: string,
  hasSources: boolean,
  fallback: string,
): Promise<string> {
  if (!ctx.llm) return fallback;
  const raw = await ctx.llm(`${SYSTEM_PROMPT}\n\n${prompt}`);
  const checked = outputGuard(raw, { hasSources, intent });
  if (!checked.ok || !raw.trim()) return fallback;
  return raw;
}

export async function runAgent(input: AgentState, ctx: AgentContext): Promise<AgentState> {
  const state: AgentState = {
    ...input,
    retrievedDocuments: [],
    toolCalls: [],
    toolResults: [],
    requiresApproval: false,
    response: "",
  };

  // Node 1: INPUT GUARD — chặn prompt injection trước khi xử lý.
  const guard = inputGuard(state.userMessage);
  if (!guard.ok) {
    state.response = guard.reason || "Tin nhắn bị chặn.";
    return state;
  }

  // Node 2: AUTHORIZATION — identity do backend cấp, không tin LLM.
  if (!ctx.permissions.includes("agent.use")) {
    state.response = "Bạn không có quyền dùng AI Agent.";
    return state;
  }

  // Node 3: INTENT.
  state.intent = classifyIntent(state.userMessage);

  // Node 4a: RAG — câu hỏi kiến thức hoặc chưa rõ ý định.
  if (state.intent === "KNOWLEDGE_QUERY" || state.intent === "UNKNOWN") {
    const docs = await ctx.rag(state.userMessage);
    state.retrievedDocuments = docs;
    if (!docs.length) {
      state.response = refusalNoSource();
      return state;
    }
    const context = docs
      .map((d: { document: string; content: string }) => `[${d.document}] ${d.content}`)
      .join("\n---\n");
    const citation = "\n\nNguồn: " + docs.map((d: { document: string }) => d.document).join(", ");
    if (ctx.llm) {
      const raw = await synthesizeWithLlm(
        ctx,
        buildRagPrompt(context, state.userMessage),
        state.intent,
        true,
        docs
          .map(
            (d: { document: string; content: string }) =>
              `${d.content.trim()}\n(Nguồn: ${d.document})`,
          )
          .join("\n\n"),
      );
      state.response = raw.includes("Nguồn:") ? raw : raw + citation;
    } else {
      // Chế độ không có LLM: trả lời bằng chính chunk, kèm citation, không bịa thêm.
      state.response = docs
        .map(
          (d: { document: string; content: string }) =>
            `${d.content.trim()}\n(Nguồn: ${d.document})`,
        )
        .join("\n\n");
    }
    return state;
  }

  // Node 4b: MCP — PRODUCT / ORDER / CART / PURCHASE.
  if (state.intent === "PRODUCT_QUERY") {
    const products = (await ctx.shop("search_products", { q: state.userMessage })) as {
      name: string;
      price: number;
      id: string;
    }[];
    state.toolCalls = [{ tool: "search_products" }];
    state.toolResults = products;
    const fallback = formatProducts(products);
    state.response = products.length
      ? await synthesizeWithLlm(
          ctx,
          buildProductPrompt(JSON.stringify(products), state.userMessage),
          state.intent,
          true,
          fallback,
        )
      : fallback;
    return state;
  }

  if (state.intent === "ORDER_QUERY") {
    const orders = (await ctx.shop("list_my_orders", {})) as {
      order_number: string;
      status: string;
      total_amount: number;
    }[];
    state.toolCalls = [{ tool: "list_my_orders" }];
    state.toolResults = orders;
    const fallback = formatOrders(orders);
    state.response = orders.length
      ? await synthesizeWithLlm(
          ctx,
          buildOrderPrompt(JSON.stringify(orders), state.userMessage),
          state.intent,
          true,
          fallback,
        )
      : fallback;
    return state;
  }

  // Các thao tác ghi LUÔN cần xác nhận: API trả về requiresApproval, không tự chạy.
  state.requiresApproval = true;
  state.response =
    state.intent === "PURCHASE_ACTION"
      ? "Để tạo đơn hàng, bạn xác nhận lại trong giỏ hàng rồi bấm Đặt hàng (hoặc gọi API orders với confirm=true). AI không tự tạo đơn khi chưa có xác nhận của bạn."
      : "Mình ghi nhận yêu cầu giỏ hàng của bạn. Bạn mở trang Giỏ hàng để xem và xác nhận.";
  return state;
}
