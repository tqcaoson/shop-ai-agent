// Service đơn hàng: tạo đơn, xem đơn, hủy đơn, đổi địa chỉ.
//
// Nguyên tắc an toàn, giữ nguyên từ bản đã kiểm chứng:
// - Kiểm tra tồn kho theo thời gian thực (đọc trực tiếp database,
//   không dùng cache) trước khi tạo đơn.
// - Chỉ chủ đơn mới được xem/hủy/sửa đơn của mình; ADMIN/STAFF được
//   xem và quản lý mọi đơn.
// - Mọi thao tác ghi đều cần confirm=true từ người dùng.
// - Tạo đơn có idempotency: gửi lại cùng một key thì trả về đơn cũ,
//   không tạo đơn mới.
import { cache } from "../../../../../packages/ai-core/src/cache";
import { db, nowIso, uid } from "../../../../../packages/database/src/db";
import { audit, type AuthedRequest } from "../../lib/middleware";
import { HttpError } from "../../lib/errors";

type User = NonNullable<AuthedRequest["user"]>;

export interface OrderItemInput {
  variant_id: string;
  quantity: number;
}

/** ADMIN hoặc STAFF được quản lý mọi đơn; CUSTOMER chỉ được đụng đơn của mình. */
export function isStaff(user: User): boolean {
  return user.roles.includes("ADMIN") || user.roles.includes("STAFF");
}

/** Tìm một đơn theo id, không có thì ném lỗi 404. */
function findOrderOrThrow(orderId: string) {
  const order = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId) as
    Record<string, unknown> | undefined;

  if (!order) {
    throw new HttpError(404, "Không tìm thấy đơn hàng.");
  }

  return order;
}

/** Kiểm tra người dùng có được xem/sửa đơn này không, không thì ném lỗi 403. */
function assertCanAccessOrder(order: Record<string, unknown>, user: User) {
  if (!isStaff(user) && order.user_id !== user.id) {
    throw new HttpError(403, "Bạn chỉ được xem đơn hàng của mình.");
  }
}

/** Lấy các dòng hàng của một đơn. */
function orderItems(orderId: string) {
  return db.prepare("SELECT * FROM order_items WHERE order_id=?").all(orderId);
}

/** Gắn các dòng hàng vào một đơn để trả về cho client. */
function orderWithItems(order: Record<string, unknown>) {
  return { ...order, items: orderItems(String(order.id)) };
}

/**
 * Tìm đơn đã tạo trước đó theo idempotency key.
 * Dùng để trả về đơn cũ khi client gửi lại cùng một yêu cầu.
 */
export function findOrderByIdempotencyKey(userId: string, idempotencyKey: string) {
  const prev = db
    .prepare(
      "SELECT result FROM agent_idempotency_keys WHERE user_id=? AND idempotency_key=? AND action='create_order'",
    )
    .get(userId, idempotencyKey) as { result: string } | undefined;

  return prev ? JSON.parse(prev.result) : null;
}

/**
 * Tạo đơn hàng từ danh sách biến thể.
 *
 * Các bước, theo đúng thứ tự:
 * 1. Nếu key idempotency đã dùng rồi thì trả về đơn cũ (replayed).
 * 2. Kiểm tra từng biến thể còn đủ tồn kho theo thời gian thực.
 * 3. Tạo đơn, tạo các dòng hàng, trừ tồn kho, xóa cache tồn kho.
 * 4. Lưu lại kết quả theo key idempotency để lần gửi lại sau trả về đơn cũ.
 */
export function createOrderFromItems(
  userId: string,
  items: OrderItemInput[],
  shippingAddress: string,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const prev = findOrderByIdempotencyKey(userId, idempotencyKey);

    if (prev) {
      return { order: prev, replayed: true };
    }
  }

  let total = 0;
  const lines: { variant: Record<string, unknown>; quantity: number }[] = [];

  for (const item of items) {
    const variant = db
      .prepare(
        "SELECT v.*, pr.name AS product_name FROM product_variants v JOIN products pr ON pr.id=v.product_id WHERE v.id=?",
      )
      .get(item.variant_id) as Record<string, unknown> | undefined;

    if (!variant) {
      throw new Error(`Biến thể không tồn tại: ${item.variant_id}`);
    }

    if (Number(variant.stock_quantity) < item.quantity) {
      throw new Error(`Hết hàng: ${variant.product_name} (còn ${variant.stock_quantity})`);
    }

    total += Number(variant.price) * item.quantity;

    lines.push({ variant, quantity: item.quantity });
  }

  const orderId = uid();
  const orderNumber = `DH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  db.prepare(
    "INSERT INTO orders (id, user_id, order_number, total_amount, status, shipping_address, created_at) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)",
  ).run(orderId, userId, orderNumber, total, shippingAddress, nowIso());

  for (const line of lines) {
    db.prepare(
      "INSERT INTO order_items (id, order_id, variant_id, product_name_snapshot, unit_price_snapshot, quantity) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      uid(),
      orderId,
      line.variant.id,
      line.variant.product_name,
      line.variant.price,
      line.quantity,
    );

    db.prepare("UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id=?").run(
      line.quantity,
      line.variant.id,
    );

    // Tồn kho đã đổi nên cache tồn kho cũ phải bỏ.
    void cache.del(cache.inventoryKey(String(line.variant.id)));
  }

  const order = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);

  if (idempotencyKey) {
    db.prepare(
      "INSERT INTO agent_idempotency_keys (id, user_id, idempotency_key, action, result, created_at) VALUES (?, ?, ?, 'create_order', ?, ?)",
    ).run(uid(), userId, idempotencyKey, JSON.stringify(order), nowIso());
  }

  return { order, replayed: false };
}

/**
 * Liệt kê đơn hàng: ADMIN/STAFF thấy mọi đơn, CUSTOMER chỉ thấy đơn của mình.
 */
export function listOrders(user: User) {
  const rows = isStaff(user)
    ? db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all()
    : db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC").all(user.id);

  return rows.map((order: Record<string, unknown>) => orderWithItems(order));
}

/** Lấy một đơn kèm các dòng hàng, có kiểm tra quyền sở hữu. */
export function getOrderById(orderId: string, user: User) {
  const order = findOrderOrThrow(orderId);

  try {
    assertCanAccessOrder(order, user);
  } catch (error) {
    audit(user.id, "order.read", orderId, "DENIED");

    throw error;
  }

  return orderWithItems(order);
}

/**
 * Hủy một đơn đang ở trạng thái PENDING.
 * Hủy xong thì hoàn lại tồn kho cho từng biến thể trong đơn.
 */
export function cancelOrder(orderId: string, user: User, confirm: boolean) {
  const order = findOrderOrThrow(orderId);

  if (!isStaff(user) && order.user_id !== user.id) {
    throw new HttpError(403, "Bạn chỉ được hủy đơn hàng của mình.");
  }

  if (order.status !== "PENDING") {
    throw new HttpError(400, "Chỉ hủy được đơn hàng đang chờ xử lý (PENDING).");
  }

  if (confirm !== true) {
    throw new HttpError(400, "Cần confirm=true trước khi hủy đơn hàng.");
  }

  db.prepare("UPDATE orders SET status='CANCELLED' WHERE id=?").run(orderId);

  const items = orderItems(orderId) as { variant_id: string; quantity: number }[];

  for (const item of items) {
    db.prepare("UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id=?").run(
      item.quantity,
      item.variant_id,
    );
  }

  audit(user.id, "order.cancel", orderId, "ALLOWED");

  return db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
}

/** Đổi địa chỉ giao hàng của một đơn, cần xác nhận của người dùng. */
export function updateOrderAddress(
  orderId: string,
  user: User,
  shippingAddress: string,
  confirm: boolean,
) {
  const order = findOrderOrThrow(orderId);

  if (!isStaff(user) && order.user_id !== user.id) {
    throw new HttpError(403, "Bạn chỉ được sửa đơn hàng của mình.");
  }

  if (confirm !== true) {
    throw new HttpError(400, "Cần confirm=true trước khi đổi địa chỉ giao hàng.");
  }

  db.prepare("UPDATE orders SET shipping_address=? WHERE id=?").run(shippingAddress, orderId);

  return db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
}
