// Script chạy tay để nạp lại knowledge lên Qdrant.
//
// Chạy từ thư mục apps/api (vì database SQLite shop.db nằm ở đó):
//   cd apps/api && npx tsx ../../packages/ai-core/src/rag/sync-run.ts
// Cách chạy khi đã chạy bằng Docker Compose (từ thư mục gốc của project):
//   docker compose exec api npx tsx ../../packages/ai-core/src/rag/sync-run.ts
//
// Yêu cầu: QDRANT_URL đã được cấu hình trong .env (ví dụ http://localhost:6333
// ở máy local, hoặc http://qdrant:6333 trong Docker Compose).
// Có key OpenAI thì dùng embedding OpenAI, không có thì dùng localEmbedding.
import path from "node:path";

import { initDb } from "../../../database/src/db.js";

import { ingestKnowledgeDir, syncKnowledgeToQdrant } from "./index.js";

// Thư mục knowledge được tính từ vị trí của file này (__dirname),
// không phụ thuộc vào thư mục hiện tại khi chạy lệnh, nên chạy từ đâu cũng đúng.
// (Dùng __dirname thay cho import.meta.url vì project biên dịch CommonJS,
// tsc với module CommonJS không cho phép import.meta.)
const knowledgeDir = path.resolve(__dirname, "..", "..", "..", "..", "knowledge");

async function main() {
  // Tạo bảng nếu database còn trống, rồi mới nạp knowledge.
  initDb();

  const chunks = ingestKnowledgeDir(knowledgeDir);
  console.log(`Đã nạp ${chunks} chunk knowledge vào SQLite.`);

  const result = await syncKnowledgeToQdrant(knowledgeDir);
  console.log(
    `Đã đồng bộ ${result.upserted} chunk lên Qdrant (collection "${result.collection}", số chiều ${result.dimension}).`,
  );
}

main().catch((error) => {
  console.error(`Đồng bộ knowledge lên Qdrant thất bại: ${(error as Error).message}`);
  process.exit(1);
});
