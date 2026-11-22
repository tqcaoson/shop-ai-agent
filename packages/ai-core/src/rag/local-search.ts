// Tìm kiếm local bằng TF-IDF trên bảng knowledge_chunks trong SQLite.
// Dùng khi chưa có Qdrant, hoặc khi Qdrant gặp lỗi — app vẫn trả lời được,
// vẫn có citation, vẫn từ chối khi không đủ nguồn.
import { db } from "../../../database/src/db.js";
import { tokens, type CitedChunk } from "./chunking.js";

interface ChunkRow {
  content: string;
  document: string;
  category: string;
}

/** Tìm topK chunk giống câu truy vấn nhất theo điểm TF-IDF. */
export function searchLocal(query: string, topK = 4): CitedChunk[] {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];

  const rows = db
    .prepare(
      `SELECT kc.content, kd.title AS document, kd.category
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id`,
    )
    .all() as ChunkRow[];
  if (rows.length === 0) return [];

  // Đếm số chunk chứa mỗi token (document frequency) để tính IDF.
  const docFreq = new Map<string, number>();
  const chunkTokenLists = rows.map((row) => tokens(row.content));
  const chunkTokens = chunkTokenLists.map((list) => {
    const counts = new Map<string, number>();
    for (const token of list) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
    for (const token of counts.keys()) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
    return counts;
  });

  // Các cặp từ liên tiếp trong câu hỏi (bigram), ví dụ "doi tra".
  // Chunk nào chứa đúng cụm từ này (theo thứ tự) thì được cộng điểm:
  // "đổi trả" là một cụm có nghĩa, khác với "theo dõi" + "trả đơn"
  // nằm rải rác trong chunk FAQ dù cùng chứa 2 token "doi" và "tra".
  const queryBigrams = new Set<string>();
  for (let i = 0; i + 1 < queryTokens.length; i++) {
    queryBigrams.add(`${queryTokens[i]} ${queryTokens[i + 1]}`);
  }
  const countMatchedBigrams = (list: string[]): number => {
    let matched = 0;
    for (const bigram of queryBigrams) {
      const [a, b] = bigram.split(" ");
      for (let i = 0; i + 1 < list.length; i++) {
        if (list[i] === a && list[i + 1] === b) {
          matched++;
          break;
        }
      }
    }
    return matched;
  };

  const totalDocs = rows.length;
  const scored = rows
    .map((row, i) => {
      let score = 0;
      for (const token of new Set(queryTokens)) {
        const tf = chunkTokens[i].get(token) || 0;
        if (tf === 0) continue;
        // IDF: token càng hiếm thì càng có giá trị phân biệt.
        const idf = Math.log(1 + totalDocs / (docFreq.get(token) || 1));
        score += tf * idf;
      }
      // Cộng điểm cụm từ: mỗi bigram khớp liên tiếp cộng 2 điểm.
      score += countMatchedBigrams(chunkTokenLists[i]) * 2;
      // Chuẩn hoá theo độ dài câu truy vấn để điểm nằm trong khoảng ổn định.
      return { ...row, score: score / Math.max(1, queryTokens.length) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored;
}
