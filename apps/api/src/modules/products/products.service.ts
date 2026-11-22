// Service sản phẩm: tìm kiếm, xem chi tiết, tạo và cập nhật.
//
// Giá và tồn kho là dữ liệu realtime nên luôn đọc từ database,
// không đọc từ Vector DB. Chi tiết sản phẩm được cache 60 giây
// và bị xóa cache ngay khi sản phẩm được cập nhật.
import { cache } from "../../../../../packages/ai-core/src/cache";
import { db, nowIso, uid } from "../../../../../packages/database/src/db";
import { audit } from "../../lib/middleware";
import { HttpError } from "../../lib/errors";

export interface ProductRow {
  id: string;
  name: string;
  description: string;
  price: number;
  status: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Chuẩn hoá một chuỗi về dạng không dấu, chữ thường để tìm kiếm. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/đ/g, "d") // "đ" không tách dấu được bằng NFD, phải đổi tay
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

/** Gắn danh sách biến thể (size, giá, tồn kho) vào một sản phẩm. */
export function productWithVariants(product: Record<string, unknown>) {
  return {
    ...product,
    variants: db
      .prepare(
        "SELECT id, sku, attributes, price, stock_quantity FROM product_variants WHERE product_id=?",
      )
      .all(product.id),
  };
}

/**
 * Liệt kê sản phẩm đang bán.
 * Tìm theo từng từ khóa: mọi từ khóa đều phải xuất hiện trong tên
 * hoặc mô tả (ví dụ "áo thun" tìm được "Áo thun cotton trắng").
 */
export function listProducts(query: string, category: string) {
  const keywords = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  const rows = db.prepare("SELECT * FROM products WHERE status='ACTIVE'").all() as Record<
    string,
    unknown
  >[];

  const filtered = rows.filter((product) => {
    const haystack = normalizeSearchText(`${product.name} ${product.description}`);
    const matchesQuery = keywords.length === 0 || keywords.every((word) => haystack.includes(word));
    const matchesCategory = !category || product.category_id === category;

    return matchesQuery && matchesCategory;
  });

  return filtered.map(productWithVariants);
}

/**
 * Lấy chi tiết một sản phẩm, có cache 60 giây.
 * Không tìm thấy thì trả về null để route trả 404.
 */
export async function getProductById(id: string) {
  const cached = await cache.get(cache.productKey(id));

  if (cached) {
    return JSON.parse(cached);
  }

  const product = db.prepare("SELECT * FROM products WHERE id=?").get(id) as
    Record<string, unknown> | undefined;

  if (!product) {
    return null;
  }

  const result = productWithVariants(product);

  // Chi tiết sản phẩm cache 1–5 phút theo spec, ở đây chọn 60 giây.
  await cache.set(cache.productKey(id), JSON.stringify(result), 60);

  return result;
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  category_id?: string;
}

/** Tạo sản phẩm mới (ADMIN/STAFF có quyền product.write). */
export function createProduct(input: CreateProductInput, userId: string) {
  const id = uid();

  db.prepare(
    "INSERT INTO products (id, name, description, price, status, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)",
  ).run(
    id,
    input.name,
    input.description,
    input.price,
    input.category_id || null,
    nowIso(),
    nowIso(),
  );

  audit(userId, "product.create", id, "ALLOWED");

  return db.prepare("SELECT * FROM products WHERE id=?").get(id);
}

export interface UpdateProductInput {
  name?: string;
  price?: number;
  status?: string;
}

/**
 * Cập nhật tên, giá hoặc trạng thái của sản phẩm.
 * Không tìm thấy thì ném lỗi 404. Cập nhật xong thì xóa cache
 * của sản phẩm đó để lần xem sau đọc dữ liệu mới.
 */
export async function updateProduct(id: string, input: UpdateProductInput) {
  const product = db.prepare("SELECT * FROM products WHERE id=?").get(id);

  if (!product) {
    throw new HttpError(404, "Không tìm thấy sản phẩm.");
  }

  if (input.name) {
    db.prepare("UPDATE products SET name=?, updated_at=? WHERE id=?").run(input.name, nowIso(), id);
  }

  if (input.price) {
    db.prepare("UPDATE products SET price=?, updated_at=? WHERE id=?").run(
      input.price,
      nowIso(),
      id,
    );
  }

  if (input.status) {
    db.prepare("UPDATE products SET status=?, updated_at=? WHERE id=?").run(
      input.status,
      nowIso(),
      id,
    );
  }

  // Invalidation: sản phẩm đổi thì cache cũ phải bỏ ngay.
  await cache.del(cache.productKey(id));

  return db.prepare("SELECT * FROM products WHERE id=?").get(id);
}
