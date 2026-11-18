// Shim tương thích ngược: code cũ import từ "./agent" vẫn chạy được.
// Logic thật đã được tách vào ./agent/intent.ts và ./agent/workflow.ts.
// Prompt nằm riêng ở ./agent/prompts.ts, import trực tiếp khi cần.
export * from "./agent/intent.js";
export * from "./agent/workflow.js";
