// Chia nhỏ văn bản thành các chunk để đưa vào RAG.
// Chunk mặc định dài 800 ký tự, chồng lấn 100 ký tự để không đứt ý ở ranh giới.

/** Một đoạn kiến thức tìm được, kèm tên tài liệu để làm citation. */
export interface CitedChunk {
  document: string;
  category: string;
  content: string;
  score: number;
}

/** Cắt văn bản thành các chunk, bỏ các chunk quá ngắn (dưới 20 ký tự). */
export function chunkText(text: string, size = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  return chunks.filter((c) => c.trim().length > 20);
}

/**
 * Các từ dừng (stopword) tiếng Việt, dạng đã bỏ dấu.
 * Đây là từ hỏi, đại từ và từ nối — chúng xuất hiện ở mọi tài liệu nên
 * không giúp phân biệt chunk nào liên quan hơn. Không lọc chúng thì câu
 * "phí ship bao nhiêu" sẽ khớp cả "bảo hành" (chứa "bao") và chấm điểm
 * sai tài liệu. Lọc ở cả câu hỏi lẫn chunk để hai bên so khớp cùng một
 * bộ từ.
 */
const STOPWORDS = new Set([
  "bao",
  "nhieu",
  "the",
  "nao",
  "gi",
  "sao",
  "lam",
  "co",
  "khong",
  "la",
  "cho",
  "minh",
  "toi",
  "ban",
  "anh",
  "chi",
  "em",
  "duoc",
  "hay",
  "va",
  "cua",
  "tai",
  "ve",
  "khi",
  "neu",
  "thi",
  "ma",
  "de",
  "voi",
  "tu",
  "den",
  "tren",
  "duoi",
  "trong",
  "ngoai",
  "nay",
  "kia",
  "day",
  "rat",
  "nhat",
  "chi",
  "xin",
  "chao",
  "giup",
  "hoi",
  "mot",
  "cac",
  "nhung",
  "dang",
  "da",
  "bi",
  "nhe",
  "oi",
  "ne",
  "nua",
  "het",
  "luon",
]);

/**
 * Tách văn bản thành các token chữ thường, bỏ dấu tiếng Việt và bỏ
 * stopword để so khớp. Token dài 1 ký tự cũng bị bỏ.
 */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/đ/g, "d") // "đ" không tách dấu được bằng NFD, phải đổi tay
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
