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

/** Tách văn bản thành các token chữ thường, bỏ dấu tiếng Việt để so khớp. */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}
