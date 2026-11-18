// Cấu hình dùng chung, đọc từ biến môi trường.
//
// Chỉ cần điền file .env là đổi được cấu hình, không cần sửa code:
// - OPENAI_API_KEY và OPENAI_MODEL: có key thì agent dùng LLM thật,
//   chưa có key thì agent dùng chế độ local.
// - QDRANT_URL và QDRANT_API_KEY: có thì RAG dùng Qdrant, chưa có
//   thì RAG dùng tìm kiếm local.
export const env = {
  port: Number(process.env.PORT || 4000),

  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",

  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4000",

  redisUrl: process.env.REDIS_URL || "",

  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",

  qdrantUrl: process.env.QDRANT_URL || "",
  qdrantKey: process.env.QDRANT_API_KEY || "",
  qdrantCollection: process.env.QDRANT_COLLECTION || "shop_knowledge",

  dailyBudget: Number(process.env.AI_DAILY_BUDGET_USD || 20),
  monthlyBudget: Number(process.env.AI_MONTHLY_BUDGET_USD || 300),

  shopId: "shop-001",
};
