// Phân loại ý định (intent) của tin nhắn người dùng.
// Khớp theo TỪ (tách từ), không khớp chuỗi con: "nào" chứa "ao" nhưng
// không phải từ "ao", "đổi trả" không được phân loại thành PRODUCT
// chỉ vì chữ "trả" nằm trong tên sản phẩm.
// Lưu ý: intent KHÔNG quyết định authorization — backend kiểm tra
// quyền độc lập trước mỗi tool.
import type { Intent } from "../../../shared-types/src/index.js";

export function classifyIntent(message: string): Intent {
  const m =
    " " +
    message
      .toLowerCase()
      .normalize("NFD")
      .replace(/đ/g, "d") // "đ" không tách dấu được bằng NFD, phải đổi tay
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ") +
    " ";
  const tokens = new Set(m.trim().split(/\s+/));
  const hasPhrase = (p: string) => m.includes(` ${p} `) || m.includes(` ${p}`);
  const hasToken = (...words: string[]) => words.some((w) => tokens.has(w));
  if (hasPhrase("don hang") || hasPhrase("ma don") || hasToken("order")) return "ORDER_QUERY";
  if (
    hasPhrase("dat hang") ||
    hasPhrase("thanh toan") ||
    hasPhrase("tao don") ||
    hasToken("checkout")
  )
    return "PURCHASE_ACTION";
  if (hasPhrase("gio hang") || hasPhrase("them vao gio") || hasToken("cart")) return "CART_ACTION";
  if (
    hasPhrase("doi tra") ||
    hasPhrase("bao hanh") ||
    hasPhrase("chinh sach") ||
    hasPhrase("phi ship") ||
    hasPhrase("van chuyen") ||
    hasToken("ship")
  )
    return "KNOWLEDGE_QUERY";
  if (
    hasToken(
      "gia",
      "ton",
      "kho",
      "san",
      "pham",
      "ao",
      "quan",
      "giay",
      "tui",
      "mu",
      "thun",
      "jeans",
      "sneaker",
      "hoodie",
      "canvas",
      "kaki",
      "linen",
      "cotton",
    )
  )
    return "PRODUCT_QUERY";
  return "UNKNOWN";
}
