// Quản lý chi phí AI: ghi log sử dụng (ai_usage_logs), tính ngân sách
// ngày/tháng và hành động theo mức đã dùng.
// 80% -> cảnh báo admin (log), 90% -> chuyển sang model rẻ hơn,
// 100% -> chặn các yêu cầu AI không thiết yếu.
// Authorization và security KHÔNG BAO GIỜ bị tắt khi vượt ngân sách.
import { db, uid, nowIso } from "../../database/src/db.js";
import { getChatModel } from "./openai.js";

// Giá ước tính theo triệu token (USD), dùng để tính chi phí cho mỗi lần gọi.
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
  local: { input: 0, output: 0 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] || PRICES["gpt-4o-mini"];
  return p.input * inputTokens + p.output * outputTokens;
}

export function logUsage(userId: string, model: string, inputTokens: number, outputTokens: number) {
  const cost = estimateCost(model, inputTokens, outputTokens);
  db.prepare(
    `INSERT INTO ai_usage_logs (id, user_id, shop_id, model, input_tokens, output_tokens, estimated_cost, created_at)
     VALUES (?, ?, 'shop-001', ?, ?, ?, ?, ?)`,
  ).run(uid(), userId, model, inputTokens, outputTokens, cost, nowIso());
  return cost;
}

export function budgetStatus() {
  const dailyBudget = Number(process.env.AI_DAILY_BUDGET_USD || 20);
  const monthlyBudget = Number(process.env.AI_MONTHLY_BUDGET_USD || 300);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const day = (
    db
      .prepare(
        `SELECT COALESCE(SUM(estimated_cost),0) AS s FROM ai_usage_logs WHERE substr(created_at,1,10)=?`,
      )
      .get(today) as { s: number }
  ).s;
  const mon = (
    db
      .prepare(
        `SELECT COALESCE(SUM(estimated_cost),0) AS s FROM ai_usage_logs WHERE substr(created_at,1,7)=?`,
      )
      .get(month) as { s: number }
  ).s;
  const dayPct = dailyBudget ? day / dailyBudget : 0;
  const monPct = monthlyBudget ? mon / monthlyBudget : 0;
  const pct = Math.max(dayPct, monPct);
  return {
    daily: { used: day, budget: dailyBudget, pct: dayPct },
    monthly: { used: mon, budget: monthlyBudget, pct: monPct },
    action:
      pct >= 1
        ? "BLOCK_NON_ESSENTIAL"
        : pct >= 0.9
          ? "ROUTE_CHEAP_MODEL"
          : pct >= 0.8
            ? "NOTIFY_ADMIN"
            : "OK",
    // Khi vượt 90% thì dùng model rẻ, không dùng model mặc định.
    effectiveModel: pct >= 0.9 ? "gpt-4o-mini" : getChatModel(),
  };
}

/**
 * Model chat thực tế nên dùng cho lần gọi tiếp theo:
 * dùng "gpt-4o-mini" khi ngân sách đã dùng từ 90% trở lên,
 * ngược lại dùng model đã cấu hình trong .env (getChatModel()).
 */
export function getEffectiveChatModel(): string {
  const status = budgetStatus();
  if (status.action === "ROUTE_CHEAP_MODEL" || status.action === "BLOCK_NON_ESSENTIAL") {
    return "gpt-4o-mini";
  }
  return getChatModel();
}
