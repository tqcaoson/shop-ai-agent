// Client Qdrant dùng chung cho RAG.
// Chỉ cần trỏ QDRANT_URL tới Qdrant local (http://localhost:6333)
// hoặc Qdrant trong Docker Compose (http://qdrant:6333) là chạy được.
// Mọi lỗi HTTP đều được ném ra dưới dạng Error tiếng Việt có dấu.
import { isOpenAIConfigured } from "./openai.js";

/** Đúng khi QDRANT_URL đã được điền (khác rỗng) trong .env. */
export function isQdrantConfigured(): boolean {
  return Boolean(process.env.QDRANT_URL && process.env.QDRANT_URL.trim() !== "");
}

/** Tên collection lấy từ .env, mặc định là shop_knowledge. */
export function getQdrantCollection(): string {
  return process.env.QDRANT_COLLECTION || "shop_knowledge";
}

/**
 * Số chiều của vector: 1536 khi dùng embedding của OpenAI
 * (text-embedding-3-small), 384 khi dùng localEmbedding() dự phòng.
 * Collection phải được tạo lại nếu đổi chế độ embedding.
 */
export function getQdrantDimension(): number {
  return isOpenAIConfigured() ? 1536 : 384;
}

function baseUrl(): string {
  return (process.env.QDRANT_URL || "").replace(/\/+$/, "");
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  // Chỉ gửi api-key khi QDRANT_API_KEY có giá trị (Qdrant local thường không cần key).
  if (process.env.QDRANT_API_KEY) h["api-key"] = process.env.QDRANT_API_KEY;
  return h;
}

async function qdrantFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Qdrant trả lỗi ${res.status} khi gọi ${path}: ${detail.slice(0, 300) || "không có chi tiết"} ` +
        `(hãy kiểm tra QDRANT_URL trong .env và xem Qdrant đã chạy chưa).`,
    );
  }
  return res;
}

/**
 * Đảm bảo collection đã tồn tại với đúng số chiều.
 * Nếu collection đã có nhưng số chiều khác, xoá rồi tạo lại và cảnh báo,
 * vì Qdrant không cho đổi số chiều của collection đang có.
 */
export async function ensureQdrantCollection(dimension: number): Promise<void> {
  const collection = getQdrantCollection();
  const res = await fetch(`${baseUrl()}/collections/${collection}`, { headers: headers() });
  if (res.status === 404) {
    await qdrantFetch(`/collections/${collection}`, {
      method: "PUT",
      body: JSON.stringify({ vectors: { size: dimension, distance: "Cosine" } }),
    });
    return;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Qdrant trả lỗi ${res.status} khi kiểm tra collection ${collection}: ` +
        `${detail.slice(0, 300) || "không có chi tiết"}.`,
    );
  }
  const data = (await res.json()) as {
    result?: { config?: { params?: { vectors?: { size?: number } } } };
  };
  const existingSize = data.result?.config?.params?.vectors?.size;
  if (existingSize !== undefined && existingSize !== dimension) {
    console.warn(
      `Cảnh báo: collection Qdrant "${collection}" đang có số chiều ${existingSize}, ` +
        `khác với số chiều yêu cầu ${dimension}. Sẽ xoá và tạo lại collection.`,
    );
    await qdrantFetch(`/collections/${collection}`, { method: "DELETE" });
    await qdrantFetch(`/collections/${collection}`, {
      method: "PUT",
      body: JSON.stringify({ vectors: { size: dimension, distance: "Cosine" } }),
    });
  }
}

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

/**
 * Ghi các điểm vào Qdrant, chia thành từng batch tối đa 100 điểm/batch.
 * Lưu ý: id của Qdrant phải là UUID hoặc số nguyên — các hàm gọi lên
 * nên truyền id dạng UUID (xem hàm pointId trong rag/index.ts).
 */
export async function upsertQdrantPoints(points: QdrantPoint[]): Promise<void> {
  const collection = getQdrantCollection();
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    await qdrantFetch(`/collections/${collection}/points`, {
      method: "PUT",
      body: JSON.stringify({ points: batch }),
    });
  }
}

export interface QdrantHit {
  document: string;
  category: string;
  content: string;
  score: number;
}

/**
 * Tìm các chunk giống vector truy vấn nhất, chỉ trong shop "shop-001".
 * Trả về kèm payload (document, category, content) để làm citation.
 */
export async function searchQdrant(vector: number[], topK: number): Promise<QdrantHit[]> {
  const collection = getQdrantCollection();
  const res = await qdrantFetch(`/collections/${collection}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector,
      limit: topK,
      with_payload: true,
      filter: { must: [{ key: "shop_id", match: { value: "shop-001" } }] },
    }),
  });
  const data = (await res.json()) as {
    result?: {
      payload?: { content?: string; document?: string; category?: string };
      score?: number;
    }[];
  };
  return (data.result || []).map((r) => ({
    document: String(r.payload?.document || "knowledge"),
    category: String(r.payload?.category || ""),
    content: String(r.payload?.content || ""),
    score: r.score || 0,
  }));
}
