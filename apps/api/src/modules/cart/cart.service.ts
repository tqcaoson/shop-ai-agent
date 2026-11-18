// Service giỏ hàng: mỗi người dùng có một giỏ duy nhất.
//
// Giỏ hàng chỉ lưu biến thể và số lượng; giá và tên sản phẩm luôn lấy
// từ database lúc đọc để không bị lệch khi giá thay đổi.
import { db, uid } from "../../../../../packages/database/src/db";

export interface CartItem {
  id: string;
  variant_id: string;
  quantity: number;
  price: number;
  sku: string;
  attributes: string;
  product_name: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
}

/**
 * Lấy giỏ hàng của người dùng, tạo giỏ mới nếu chưa có.
 * Giỏ trống thì trả về giỏ có items là mảng rỗng.
 */
export function getCart(userId: string): Cart {
  let cart = db.prepare("SELECT * FROM carts WHERE user_id=?").get(userId) as
    { id: string } | undefined;

  if (!cart) {
    const id = uid();

    db.prepare("INSERT INTO carts (id, user_id) VALUES (?, ?)").run(id, userId);

    cart = { id };
  }

  const items = db
    .prepare(
      `SELECT ci.id, ci.variant_id, ci.quantity, v.price, v.sku, v.attributes,
              pr.name AS product_name
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products pr ON pr.id = v.product_id
       WHERE ci.cart_id=?`,
    )
    .all(cart.id) as CartItem[];

  return { id: cart.id, items };
}

/**
 * Thêm một biến thể vào giỏ. Biến thể đã có trong giỏ thì cộng dồn số lượng.
 */
export function addCartItem(userId: string, variantId: string, quantity: number): Cart {
  const cart = getCart(userId);

  const existing = db
    .prepare("SELECT * FROM cart_items WHERE cart_id=? AND variant_id=?")
    .get(cart.id, variantId) as { id: string; quantity: number } | undefined;

  if (existing) {
    db.prepare("UPDATE cart_items SET quantity=? WHERE id=?").run(
      existing.quantity + quantity,
      existing.id,
    );
  } else {
    db.prepare(
      "INSERT INTO cart_items (id, cart_id, variant_id, quantity) VALUES (?, ?, ?, ?)",
    ).run(uid(), cart.id, variantId, quantity);
  }

  return getCart(userId);
}

/** Xóa một dòng khỏi giỏ hàng của chính người dùng đó. */
export function removeCartItem(userId: string, cartItemId: string): Cart {
  const cart = getCart(userId);

  db.prepare("DELETE FROM cart_items WHERE id=? AND cart_id=?").run(cartItemId, cart.id);

  return getCart(userId);
}
