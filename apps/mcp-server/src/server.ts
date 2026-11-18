// MCP Server — chỉ gọi Shop Backend API, KHÔNG chạm trực tiếp vào database.
//
// Mỗi tool đều truyền token JWT của người dùng, backend tự kiểm tra
// quyền (permission) và quyền sở hữu (ownership) trước khi chạy.
// Tool ghi bắt buộc confirm=true và hỗ trợ idempotencyKey để gửi lại
// cùng một yêu cầu không tạo trùng đơn.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = process.env.API_BASE_URL || "http://localhost:4000";

/**
 * Gọi một endpoint của Shop Backend API bằng token JWT của người dùng.
 * Lỗi từ API (401, 403, 404...) được ném lại nguyên trạng thái và nội dung.
 */
async function api(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

const tokenField = {
  token: z.string().describe("JWT của người dùng, backend dùng để xác thực và phân quyền"),
};

const server = new McpServer({ name: "shop-mcp-server", version: "1.0.0" });

server.tool(
  "search_products",
  "Tìm sản phẩm theo từ khóa",
  { ...tokenField, q: z.string() },
  async ({ token, q }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await api(token, `/products?q=${encodeURIComponent(q)}`)),
      },
    ],
  }),
);

server.tool(
  "get_product",
  "Xem chi tiết một sản phẩm kèm biến thể và tồn kho",
  { ...tokenField, id: z.string() },
  async ({ token, id }) => ({
    content: [{ type: "text", text: JSON.stringify(await api(token, `/products/${id}`)) }],
  }),
);

server.tool(
  "check_inventory",
  "Kiểm tra tồn kho theo thời gian thực của một biến thể",
  { ...tokenField, product_id: z.string(), variant_id: z.string() },
  async ({ token, product_id, variant_id }) => {
    const product = (await api(token, `/products/${product_id}`)) as {
      variants: { id: string; stock_quantity: number }[];
    };

    const variant = product.variants.find((item) => item.id === variant_id);

    return {
      content: [
        { type: "text", text: JSON.stringify(variant || { error: "Không tìm thấy biến thể" }) },
      ],
    };
  },
);

server.tool(
  "get_order",
  "Tra cứu một đơn hàng (chỉ đơn của mình, trừ ADMIN/STAFF)",
  { ...tokenField, id: z.string() },
  async ({ token, id }) => ({
    content: [{ type: "text", text: JSON.stringify(await api(token, `/orders/${id}`)) }],
  }),
);

server.tool(
  "list_my_orders",
  "Danh sách đơn hàng của người dùng đang đăng nhập",
  tokenField,
  async ({ token }) => ({
    content: [{ type: "text", text: JSON.stringify(await api(token, "/orders")) }],
  }),
);

server.tool(
  "get_shipping_status",
  "Trạng thái vận chuyển của một đơn hàng",
  { ...tokenField, id: z.string() },
  async ({ token, id }) => {
    const order = (await api(token, `/orders/${id}`)) as { status: string; order_number: string };

    const statusText: Record<string, string> = {
      PENDING: "Chờ xử lý",
      CONFIRMED: "Đã xác nhận",
      SHIPPING: "Đang giao",
      DELIVERED: "Đã giao",
      CANCELLED: "Đã hủy",
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            order_number: order.order_number,
            status: order.status,
            shipping_text: statusText[order.status] || order.status,
          }),
        },
      ],
    };
  },
);

server.tool(
  "create_order",
  "Tạo đơn hàng — CẦN confirm=true",
  {
    ...tokenField,
    shipping_address: z.string(),
    confirm: z.boolean(),
    items: z.array(z.object({ variant_id: z.string(), quantity: z.number() })).optional(),
    use_cart: z.boolean().optional(),
    idempotencyKey: z.string().optional(),
  },
  async ({ token, shipping_address, confirm, items, use_cart, idempotencyKey }) => {
    if (!confirm) {
      throw new Error("Cần confirm=true trước khi tạo đơn hàng.");
    }

    const output = await api(token, "/orders", {
      method: "POST",
      headers: idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify({ shipping_address, confirm: true, items, use_cart }),
    });

    return { content: [{ type: "text", text: JSON.stringify(output) }] };
  },
);

server.tool(
  "cancel_order",
  "Hủy đơn hàng đang chờ xử lý (PENDING) — CẦN confirm=true",
  { ...tokenField, id: z.string(), confirm: z.boolean() },
  async ({ token, id, confirm }) => {
    if (!confirm) {
      throw new Error("Cần confirm=true trước khi hủy đơn hàng.");
    }

    const output = await api(token, `/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });

    return { content: [{ type: "text", text: JSON.stringify(output) }] };
  },
);

server.tool(
  "update_shipping_address",
  "Đổi địa chỉ giao hàng của một đơn hàng — CẦN confirm=true",
  { ...tokenField, id: z.string(), shipping_address: z.string(), confirm: z.boolean() },
  async ({ token, id, shipping_address, confirm }) => {
    if (!confirm) {
      throw new Error("Cần confirm=true trước khi đổi địa chỉ giao hàng.");
    }

    const output = await api(token, `/orders/${id}/address`, {
      method: "PATCH",
      body: JSON.stringify({ shipping_address, confirm: true }),
    });

    return { content: [{ type: "text", text: JSON.stringify(output) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("MCP Server đang chạy qua stdio, gọi API ở " + API);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
