// Shim tương thích ngược: code cũ import từ "./rag" vẫn chạy được.
// Logic thật đã được tách vào ./rag/index.ts và ./rag/chunking.ts.
export * from "./rag/index.js";
export * from "./rag/chunking.js";
