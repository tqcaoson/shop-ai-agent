// RAG: nạp knowledge, đồng bộ lên Qdrant và truy vấn.
// Thứ tự ưu tiên khi tìm kiếm: Qdrant trước, lỗi thì dùng tìm kiếm local TF-IDF.
// Dữ liệu realtime (giá, tồn kho, đơn hàng) KHÔNG lấy từ Vector DB,
// mà lấy từ Shop Backend.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, uid } from "../../../database/src/db.js";
import { chunkText, type CitedChunk } from "./chunking.js";
import { searchLocal } from "./local-search.js";
import { embedText, isOpenAIConfigured, localEmbedding } from "../openai.js";
import {
  ensureQdrantCollection,
  getQdrantCollection,
  getQdrantDimension,
  isQdrantConfigured,
  searchQdrant,
  upsertQdrantPoints,
} from "../qdrant.js";

/**
 * Đọc toàn bộ file .md trong thư mục knowledge, chia chunk và lưu vào SQLite
 * để việc truy vấn có citation ổn định. Trả về số chunk đã nạp.
 * Hành vi đồng bộ (sync), giữ nguyên như bản cũ.
 */
export function ingestKnowledgeDir(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) {
        walk(p);
      } else if (f.name.endsWith(".md")) {
        const text = fs.readFileSync(p, "utf-8");
        const title = path.basename(p);
        const category = path.basename(path.dirname(p));
        const existing = db
          .prepare("SELECT id FROM knowledge_documents WHERE title=?")
          .get(title) as { id: string } | undefined;
        const docId = existing?.id || uid();
        if (!existing) {
          db.prepare(
            "INSERT INTO knowledge_documents (id, title, category, version) VALUES (?, ?, ?, 1)",
          ).run(docId, title, category);
        } else {
          db.prepare("DELETE FROM knowledge_chunks WHERE document_id=?").run(docId);
        }
        chunkText(text).forEach((content, i) => {
          // Id chunk ổn định theo tài liệu + số thứ tự, không dùng id ngẫu nhiên:
          // nạp lại knowledge nhiều lần vẫn cho ra cùng id, nên đồng bộ lên
          // Qdrant sẽ ghi đè đúng điểm cũ thay vì để lại điểm cũ thừa.
          db.prepare(
            `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, metadata)
             VALUES (?, ?, ?, ?, ?)`,
          ).run(
            `chunk-${docId}-${i}`,
            docId,
            i,
            content,
            JSON.stringify({
              shop_id: "shop-001",
              category,
              visibility: ["ADMIN", "STAFF", "CUSTOMER"],
              version: 1,
            }),
          );
          count++;
        });
      }
    }
  };
  walk(dir);
  return count;
}

/**
 * Chuyển một id chuỗi bất kỳ thành UUID xác định (deterministic),
 * vì id của điểm Qdrant chỉ được là UUID hoặc số nguyên.
 * Cùng một chunk luôn cho ra cùng một UUID nên đồng bộ lại không bị trùng.
 */
function pointIdFromString(value: string): string {
  const hex = crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export interface SyncKnowledgeResult {
  upserted: number;
  collection: string;
  dimension: number;
}

/**
 * Đồng bộ các chunk đã có trong SQLite lên Qdrant.
 * Có key OpenAI thì dùng embedText(), không có thì dùng localEmbedding()
 * để Qdrant local vẫn chạy được mà không cần mạng.
 */
export async function syncKnowledgeToQdrant(dir: string): Promise<SyncKnowledgeResult> {
  void dir; // Giữ tham số dir cho tương thích API: chunk luôn được đọc từ SQLite.
  if (!isQdrantConfigured()) {
    throw new Error("Chưa cấu hình QDRANT_URL trong .env, không thể đồng bộ lên Qdrant.");
  }
  const dimension = getQdrantDimension();
  await ensureQdrantCollection(dimension);

  const rows = db
    .prepare(
      `SELECT kc.id AS chunk_id, kc.content, kd.title AS document, kd.category
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       ORDER BY kd.title, kc.chunk_index`,
    )
    .all() as { chunk_id: string; content: string; document: string; category: string }[];

  const points = [];
  for (const row of rows) {
    // Dùng embedding OpenAI khi có key, ngược lại dùng embedding local xác định.
    const vector = isOpenAIConfigured()
      ? await embedText(row.content)
      : localEmbedding(row.content, dimension);
    points.push({
      id: pointIdFromString(row.chunk_id),
      vector,
      payload: {
        chunk_id: row.chunk_id,
        document: row.document,
        category: row.category,
        content: row.content,
        shop_id: "shop-001",
      },
    });
  }
  if (points.length > 0) {
    await upsertQdrantPoints(points);
  }
  return { upserted: points.length, collection: getQdrantCollection(), dimension };
}

/**
 * Chỉ giữ lại các chunk có điểm từ 70% điểm cao nhất trở lên (luôn giữ
 * chunk đứng đầu). Không lọc thì câu trả lời ở chế độ local sẽ nối cả
 * những chunk chỉ khớp loáng thoáng (ví dụ hỏi "đổi trả" mà cả chunk
 * FAQ cũng được nối vào), làm câu trả lời dài và lạc đề. Ngưỡng 70%
 * vẫn giữ được chunk thứ hai khi câu hỏi thực sự cần 2 tài liệu
 * (điểm của chúng thường gần nhau), nhưng loại chunk chỉ khớp nhờ
 * 1-2 từ lẻ.
 */
function keepRelevantOnly(hits: CitedChunk[]): CitedChunk[] {
  if (hits.length === 0) return hits;
  const best = hits[0].score;
  if (best <= 0) return hits;
  return hits.filter((hit) => hit.score >= best * 0.7);
}

/**
 * Tìm kiến thức cho một câu hỏi.
 * Thử Qdrant trước nếu đã cấu hình; gặp lỗi hoặc không có kết quả thì
 * dùng tìm kiếm local và ghi cảnh báo tiếng Việt, không làm hỏng request.
 */
export async function searchKnowledge(
  query: string,
  roles: string[],
  topK = 4,
): Promise<CitedChunk[]> {
  // Trong MVP, mọi chunk đều có visibility gồm ADMIN, STAFF và CUSTOMER,
  // nên tham số roles được giữ lại cho tương thích và để lọc ở tầng cao hơn
  // khi knowledge có tài liệu chỉ dành cho một số vai trò nhất định.
  void roles;

  if (isQdrantConfigured()) {
    try {
      const dimension = getQdrantDimension();
      const vector = isOpenAIConfigured()
        ? await embedText(query)
        : localEmbedding(query, dimension);
      const hits = await searchQdrant(vector, topK);
      if (hits.length > 0) return keepRelevantOnly(hits);
      console.warn("Cảnh báo: Qdrant không trả về kết quả nào, sẽ dùng tìm kiếm local.");
    } catch (error) {
      console.warn(
        `Cảnh báo: không tìm được trên Qdrant (${(error as Error).message}), sẽ dùng tìm kiếm local.`,
      );
    }
  }
  return keepRelevantOnly(searchLocal(query, topK));
}
