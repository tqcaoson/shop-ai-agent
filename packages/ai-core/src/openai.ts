// Client OpenAI dùng chung cho toàn bộ agent.
// Chỉ cần thay OPENAI_API_KEY và OPENAI_MODEL (hoặc EMBEDDING_MODEL)
// trong file .env là chạy được, không cần sửa code ở nơi khác.
// Khi chưa có key, các hàm gọi API sẽ báo lỗi rõ ràng bằng tiếng Việt;
// hàm localEmbedding() là phương án dự phòng không cần mạng.
import crypto from "node:crypto";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

/** Đúng khi OPENAI_API_KEY đã được điền (khác rỗng) trong .env. */
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== "");
}

/** Model chat lấy từ .env, mặc định là gpt-4o-mini. */
export function getChatModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

/** Model embedding lấy từ .env, mặc định là text-embedding-3-small. */
export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || "text-embedding-3-small";
}

/** Đọc thân lỗi của OpenAI (nếu có) để đưa vào thông báo lỗi tiếng Việt. */
async function readErrorBody(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message || "";
  } catch {
    return "";
  }
}

function openAiError(status: number, detail: string, action: string): Error {
  const hint =
    status === 401
      ? "key không hợp lệ hoặc đã hết hạn, hãy kiểm tra OPENAI_API_KEY trong .env"
      : status === 429
        ? "đã vượt giới hạn tốc độ hoặc hết hạn mức, hãy thử lại sau"
        : status === 400
          ? "yêu cầu gửi lên không hợp lệ, hãy kiểm tra model và nội dung gửi lên"
          : "hãy kiểm tra lại key, model và kết nối mạng";
  return new Error(
    `OpenAI trả lỗi ${status} khi ${action}: ${detail || "không có chi tiết"} (${hint}).`,
  );
}

export interface ChatCompletionInput {
  system: string;
  user: string;
  maxTokens?: number;
  /**
   * Model muốn dùng cho lần gọi này. Không truyền thì dùng model trong .env.
   * Cost Manager dùng trường này để chuyển sang model rẻ khi ngân sách đã
   * dùng từ 90% trở lên (xem getEffectiveChatModel() trong cost.ts).
   */
  model?: string;
}

export interface ChatCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Gọi Chat Completions của OpenAI với model lấy từ getChatModel().
 * Ném lỗi tiếng Việt có dấu khi chưa có key hoặc khi OpenAI trả lỗi HTTP.
 */
export async function chatCompletion(input: ChatCompletionInput): Promise<ChatCompletionResult> {
  if (!isOpenAIConfigured()) {
    throw new Error("Chưa cấu hình OPENAI_API_KEY trong .env.");
  }
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model || getChatModel(),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      max_tokens: input.maxTokens ?? 600,
    }),
  });
  if (!res.ok) {
    throw openAiError(res.status, await readErrorBody(res), "gọi Chat Completions");
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content || "",
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

/**
 * Tạo embedding bằng OpenAI với model lấy từ getEmbeddingModel().
 * Ném lỗi tiếng Việt có dấu khi chưa có key hoặc khi OpenAI trả lỗi HTTP.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!isOpenAIConfigured()) {
    throw new Error("Chưa cấu hình OPENAI_API_KEY trong .env.");
  }
  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: getEmbeddingModel(), input: text }),
  });
  if (!res.ok) {
    throw openAiError(res.status, await readErrorBody(res), "tạo embedding");
  }
  const data = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vector = data.data?.[0]?.embedding;
  if (!vector) {
    throw new Error("OpenAI không trả về vector embedding, hãy thử lại.");
  }
  return vector;
}

/**
 * Embedding xác định (deterministic), không cần mạng, dùng làm dự phòng
 * khi chưa có key OpenAI — Qdrant vẫn lưu và tìm kiếm được knowledge.
 * Mỗi token được băm (FNV-1a) thành một vị trí trong vector, rồi chuẩn hoá L2.
 * Cùng một đoạn văn bản luôn cho ra cùng một vector.
 */
export function localEmbedding(text: string, dim = 384): number[] {
  const vector = new Array<number>(dim).fill(0);
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  for (const word of words) {
    // Băm FNV-1a: vị trí và dấu của token trong vector.
    let hash = 0x811c9dc5;
    for (let i = 0; i < word.length; i++) {
      hash ^= word.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const index = Math.abs(hash) % dim;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign;
    // Thêm một vị trí thứ hai từ SHA-256 để giảm va chạm giữa các từ khác nhau.
    const extra = crypto.createHash("sha256").update(word).digest();
    vector[extra[0] % dim] += 0.5 * sign;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}
