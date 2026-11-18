// Script chạy seed bằng tay: `npm --workspace apps/api run seed`.
//
// Nạp dữ liệu mẫu (người dùng, sản phẩm) rồi nạp tài liệu knowledge
// trong thư mục knowledge/ thành các chunk để RAG truy vấn.
import path from "node:path";

import { ingestKnowledgeDir } from "../../../packages/ai-core/src/rag";
import { config } from "./config";
import { seed } from "./seed";

seed();

const chunkCount = ingestKnowledgeDir(config.knowledgeDir);

console.log(`Đã seed xong. Số chunk knowledge: ${chunkCount}`);
