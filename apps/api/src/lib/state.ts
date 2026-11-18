// Trạng thái dùng chung của toàn bộ API trong lúc chạy.
//
// knowledgeVersion tăng mỗi lần nạp lại knowledge (POST /rag/ingest).
// Phiên bản này được đưa vào cache key của câu trả lời RAG, nên knowledge
// mới sẽ tự động làm mất hiệu lực cache cũ mà không cần xóa tay.
export const appState = {
  knowledgeVersion: 1,
};

/** Tăng phiên bản knowledge lên 1 và trả về phiên bản mới. */
export function bumpKnowledgeVersion(): number {
  appState.knowledgeVersion += 1;

  return appState.knowledgeVersion;
}
