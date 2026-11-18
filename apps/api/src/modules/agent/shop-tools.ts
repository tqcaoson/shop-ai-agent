// Các hàm "shop tool" mà Agent gọi để lấy dữ liệu nghiệp vụ.
//
// Đây là ranh giới quan trọng: Agent (và LLM bên trong nó) chỉ gọi
// các hàm này, không bao giờ tự truy vấn database. Dữ liệu realtime
// như giá, tồn kho, đơn hàng luôn lấy từ Shop Backend, không lấy
// từ Vector DB.
import { db } from "../../../../../packages/database/src/db";
import { normalizeSearchText } from "../products/products.service";

/**
 * Các từ bỏ qua khi tách từ khóa từ câu hỏi tự nhiên.
 * Ví dụ: "áo thun giá bao nhiêu" chỉ còn từ khóa "áo", "thun".
 */
const STOPWORDS = new Set([
  "gia",
  "bao",
  "nhieu",
  "the",
  "nao",
  "cho",
  "minh",
  "xem",
  "co",
  "khong",
  "la",
  "gi",
  "cua",
  "toi",
  "ban",
  "san",
  "pham",
  "con",
  "hang",
]);

/**
 * Tìm sản phẩm theo câu hỏi tự nhiên.
 * Tách câu hỏi thành từ khóa (đã bỏ dấu và bỏ stopword), sản phẩm nào
 * chứa bất kỳ từ khóa nào trong tên hoặc mô tả thì được trả về.
 */
export function searchProductsByQuestion(question: string) {
  const rows = db.prepare("SELECT * FROM products WHERE status='ACTIVE'").all() as Record<
    string,
    unknown
  >[];

  const keywords = normalizeSearchText(question)
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word));

  if (keywords.length === 0) {
    return rows.slice(0, 10);
  }

  return rows
    .filter((product) => {
      const haystack = normalizeSearchText(`${product.name} ${product.description}`);

      return keywords.some((word) => haystack.includes(word));
    })
    .slice(0, 10);
}

/**
 * Chạy một shop tool cho Agent.
 * Chỉ có 2 tool đọc được Agent dùng trong MVP; tool nào khác thì trả về [].
 */
export async function shop(
  tool: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  if (tool === "search_products") {
    return searchProductsByQuestion(String((args as { q?: string }).q || ""));
  }

  if (tool === "list_my_orders") {
    return db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC").all(userId);
  }

  return [];
}
