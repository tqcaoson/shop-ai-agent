// Điểm khởi động của API.
//
// File này cố tình giữ thật mỏng, chỉ làm 5 việc theo thứ tự:
// 1. Khởi tạo database (tạo bảng, quyền và vai trò mặc định).
// 2. Seed dữ liệu mẫu nếu database đang trống.
// 3. Nạp tài liệu knowledge để RAG truy vấn được ngay.
// 4. Đồng bộ knowledge lên Qdrant nếu đã cấu hình QDRANT_URL
//    (thất bại thì chỉ ghi log, RAG vẫn dùng tìm kiếm local).
// 5. Tạo Express app (xem app.ts) và lắng nghe cổng đã cấu hình.
//
// Mọi route và logic nghiệp vụ nằm trong app.ts và
// các module ở apps/api/src/modules/.
import { ingestKnowledgeDir, syncKnowledgeToQdrant } from "../../../packages/ai-core/src/rag";
import { initDb } from "../../../packages/database/src/db";
import { createApp } from "./app";
import { config } from "./config";
import { seed } from "./seed";

async function main() {
  initDb();
  seed();
  ingestKnowledgeDir(config.knowledgeDir);

  // Đồng bộ lên Qdrant ngay khi khởi động để sau `docker compose up`
  // là knowledge đã có trong Vector DB, không cần chạy tay thêm.
  // Không có Qdrant thì bỏ qua, không làm hỏng quá trình khởi động.
  try {
    const result = await syncKnowledgeToQdrant(config.knowledgeDir);
    console.log(
      `Đã đồng bộ ${result.upserted} chunk knowledge lên Qdrant (collection "${result.collection}").`,
    );
  } catch (error) {
    console.log(`Qdrant: ${(error as Error).message} — RAG dùng tìm kiếm local trên SQLite.`);
  }

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`API đang chạy tại http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error(`Không khởi động được API: ${(error as Error).message}`);
  process.exit(1);
});
