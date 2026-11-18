// Route RAG: nạp lại tài liệu knowledge vào database và lên Qdrant.
//
// Sau khi nạp xong, phiên bản knowledge được tăng lên để cache
// của các câu trả lời cũ tự động hết hiệu lực.
import { Router } from "express";

import { ingestKnowledgeDir, syncKnowledgeToQdrant } from "../../../../../packages/ai-core/src/rag";
import { config } from "../../config";
import { auth, requirePermission } from "../../lib/middleware";
import { bumpKnowledgeVersion } from "../../lib/state";

export const ragRouter = Router();

/** POST /rag/ingest — nạp lại toàn bộ tài liệu trong thư mục knowledge/. */
ragRouter.post("/ingest", auth, requirePermission("product.write"), async (_req, res) => {
  const chunkCount = ingestKnowledgeDir(config.knowledgeDir);
  const knowledgeVersion = bumpKnowledgeVersion();

  // Đồng bộ lên Qdrant nếu đã cấu hình; không có Qdrant thì vẫn trả
  // về kết quả nạp SQLite và ghi rõ lý do chưa đồng bộ.
  let qdrant: { synced: boolean; upserted?: number; collection?: string; reason?: string };

  try {
    const result = await syncKnowledgeToQdrant(config.knowledgeDir);
    qdrant = { synced: true, upserted: result.upserted, collection: result.collection };
  } catch (error) {
    qdrant = { synced: false, reason: (error as Error).message };
  }

  return res.json({ chunks: chunkCount, knowledgeVersion, qdrant });
});
