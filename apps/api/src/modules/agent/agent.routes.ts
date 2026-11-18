// Route AI Agent: chat với agent và xem thống kê dùng AI.
//
// Luồng xử lý của một tin nhắn chat (theo workflow LangGraph trong thiết kế):
// INPUT GUARD -> AUTHORIZATION -> INTENT -> RAG node hoặc MCP node
// -> OUTPUT VALIDATOR -> RESPONSE.
//
// Lưu ý: OpenAI chỉ được gọi qua client dùng chung ở
// packages/ai-core/src/openai.ts. Chỉ cần điền OPENAI_API_KEY và
// OPENAI_MODEL trong file .env là chạy được, không sửa code ở đây.
// Chưa có key thì agent dùng chế độ local (trả lời bằng chunk RAG
// kèm citation, không bịa thêm thông tin).
import { Router } from "express";
import { z } from "zod";

import { runAgent } from "../../../../../packages/ai-core/src/agent";
import { cache } from "../../../../../packages/ai-core/src/cache";
import {
  budgetStatus,
  getEffectiveChatModel,
  logUsage,
} from "../../../../../packages/ai-core/src/cost";
import { chatCompletion, isOpenAIConfigured } from "../../../../../packages/ai-core/src/openai";
import { searchKnowledge } from "../../../../../packages/ai-core/src/rag";
import { db, nowIso, uid } from "../../../../../packages/database/src/db";
import { auth, rateLimit, requirePermission, type AuthedRequest } from "../../lib/middleware";
import { handleRouteError, sendError } from "../../lib/errors";
import { appState } from "../../lib/state";
import { shop } from "./shop-tools";

export const agentRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  session_id: z.string().optional(),
});

/** POST /agent/chat — gửi một tin nhắn cho AI Agent. */
agentRouter.post("/chat", auth, rateLimit(20, 60_000), async (req: AuthedRequest, res) => {
  const body = chatSchema.safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Tin nhắn không hợp lệ.");
  }

  // Ngân sách AI đã dùng hết thì chặn các yêu cầu AI không thiết yếu.
  // Các kiểm tra bảo mật và phân quyền không bao giờ bị tắt khi hết ngân sách.
  const budget = budgetStatus();

  if (budget.action === "BLOCK_NON_ESSENTIAL") {
    return sendError(
      res,
      402,
      "Đã hết ngân sách AI trong ngày/tháng. Chỉ các tác vụ bảo mật vẫn chạy, AI tạm dừng.",
    );
  }

  const userId = req.user!.id;
  const sessionId = body.data.session_id || uid();

  db.prepare(
    "INSERT OR IGNORE INTO agent_sessions (id, user_id, session_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(uid(), userId, sessionId, nowIso());

  db.prepare(
    "INSERT INTO agent_messages (id, session_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
  ).run(uid(), sessionId, body.data.message, nowIso());

  // Exact cache: chỉ dùng cho câu hỏi knowledge, key gồm tenant + phạm vi
  // quyền + phiên bản knowledge. Không cache câu trả lời chứa dữ liệu cá nhân.
  const scope = req.user!.roles.join(",");
  const cacheKey = cache.exactKey("shop-001", scope, appState.knowledgeVersion, body.data.message);
  const cached = await cache.get(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);

    return res.json({ ...parsed, cached: true });
  }

  // Có key OpenAI thì dùng LLM thật, ghi lại token và chi phí sau mỗi lần gọi.
  // Model lấy từ getEffectiveChatModel(): ngân sách đã dùng từ 90% trở lên
  // thì tự chuyển sang model rẻ (gpt-4o-mini), ngược lại dùng model trong .env.
  // Chưa có key thì để llm là undefined để runAgent dùng chế độ local.
  const effectiveModel = getEffectiveChatModel();
  const llm = isOpenAIConfigured()
    ? async (prompt: string): Promise<string> => {
        const result = await chatCompletion({
          system:
            "Bạn là trợ lý bán hàng của shop. Chỉ trả lời dựa trên nguồn được cung cấp, không bịa thông tin.",
          user: prompt,
          maxTokens: 600,
          model: effectiveModel,
        });

        logUsage(userId, effectiveModel, result.inputTokens, result.outputTokens);

        return result.text;
      }
    : undefined;

  try {
    const result = await runAgent(
      {
        conversationId: sessionId,
        userId,
        shopId: "shop-001",
        intent: "",
        userMessage: body.data.message,
        retrievedDocuments: [],
        toolCalls: [],
        toolResults: [],
        requiresApproval: false,
        response: "",
      },
      {
        userId,
        roles: req.user!.roles,
        permissions: req.user!.permissions,
        rag: (question) => searchKnowledge(question, req.user!.roles, 4),
        shop: (tool, args) => shop(tool, args, userId),
        llm,
      },
    );

    db.prepare(
      "INSERT INTO agent_messages (id, session_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)",
    ).run(uid(), sessionId, result.response, nowIso());

    const output = {
      session_id: sessionId,
      intent: result.intent,
      response: result.response,
      requiresApproval: result.requiresApproval,
      sources: result.retrievedDocuments,
      toolCalls: result.toolCalls,
    };

    // Chỉ cache câu trả lời knowledge, không cache đơn hàng, tồn kho hay thao tác ghi.
    if (result.intent === "KNOWLEDGE_QUERY") {
      await cache.set(cacheKey, JSON.stringify(output), 3600);
    }

    return res.json(output);
  } catch (error) {
    // Lỗi từ OpenAI (key sai, hết hạn mức, mất mạng) thì trả về 502 rõ ràng,
    // không để server crash và không lộ chi tiết kỹ thuật cho client.
    if (error instanceof Error && error.message.includes("OpenAI")) {
      return sendError(
        res,
        502,
        `Không gọi được OpenAI, vui lòng thử lại sau. Chi tiết: ${error.message}`,
      );
    }

    return handleRouteError(res, error);
  }
});

/** GET /agent/usage — ngân sách AI và lịch sử dùng token (chỉ ADMIN). */
agentRouter.get("/usage", auth, requirePermission("user.manage"), (_req, res) => {
  return res.json({
    budget: budgetStatus(),
    logs: db.prepare("SELECT * FROM ai_usage_logs ORDER BY created_at DESC LIMIT 50").all(),
  });
});
