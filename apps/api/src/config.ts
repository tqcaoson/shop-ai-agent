// Cấu hình của API, đọc từ biến môi trường.
//
// Chỉ cần sửa file .env là đổi được cấu hình, không cần sửa code:
// - PORT: cổng API lắng nghe (mặc định 4000).
// - JWT_SECRET: khóa ký token đăng nhập, bắt buộc đổi trước khi dùng thật.
// - API_BASE_URL: địa chỉ API mà MCP Server gọi tới.
import path from "node:path";

export const config = {
  port: Number(process.env.PORT || 4000),

  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",

  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4000",

  // Thư mục chứa tài liệu knowledge (products, policies, operations).
  // server.ts chạy từ apps/api nên phải lùi 2 cấp mới tới thư mục gốc.
  knowledgeDir: path.join(process.cwd(), "..", "..", "knowledge"),
};
