// Route đơn hàng: tạo đơn, xem đơn, hủy đơn, đổi địa chỉ giao hàng.
import { Router } from "express";
import { z } from "zod";

import { db } from "../../../../../packages/database/src/db";
import { auth, audit, requirePermission, type AuthedRequest } from "../../lib/middleware";
import { handleRouteError, sendError } from "../../lib/errors";
import { getCart } from "../cart/cart.service";
import {
  cancelOrder,
  createOrderFromItems,
  findOrderByIdempotencyKey,
  getOrderById,
  listOrders,
  updateOrderAddress,
  type OrderItemInput,
} from "./orders.service";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  shipping_address: z.string().min(3),
  items: z
    .array(z.object({ variant_id: z.string(), quantity: z.number().int().positive() }))
    .optional(),
  use_cart: z.boolean().optional(),
  confirm: z.boolean(),
});

/**
 * POST /orders — tạo đơn hàng.
 *
 * Idempotency được kiểm tra TRƯỚC khi kiểm tra giỏ trống: gửi lại
 * cùng một X-Idempotency-Key thì trả về đơn cũ, kể cả khi giỏ hàng
 * đã bị xóa sau lần tạo đơn đầu tiên.
 */
ordersRouter.post("/", auth, requirePermission("order.create"), (req: AuthedRequest, res) => {
  const body = createOrderSchema.safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Dữ liệu không hợp lệ.");
  }

  if (!body.data.confirm) {
    return sendError(
      res,
      400,
      "Cần confirm=true trước khi tạo đơn hàng (xác nhận của người dùng).",
    );
  }

  const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;

  if (idempotencyKey) {
    const previousOrder = findOrderByIdempotencyKey(req.user!.id, idempotencyKey);

    if (previousOrder) {
      return res.json({ order: previousOrder, replayed: true });
    }
  }

  try {
    // safeParse ở trên đã kiểm tra từng dòng hàng phải có đủ variant_id
    // và quantity. Dấu ! chỉ để qua kiểm tra kiểu của zod 3.25
    // (nó suy luận mọi thuộc tính của object thành optional).
    let items: OrderItemInput[] = (body.data.items ?? []).map((item) => ({
      variant_id: item.variant_id!,
      quantity: item.quantity!,
    }));

    if (body.data.use_cart || items.length === 0) {
      const cart = getCart(req.user!.id);

      items = (cart.items as { variant_id: string; quantity: number }[]).map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      }));
    }

    if (items.length === 0) {
      return sendError(res, 400, "Giỏ hàng trống.");
    }

    const { order, replayed } = createOrderFromItems(
      req.user!.id,
      items,
      body.data.shipping_address,
      idempotencyKey,
    );

    if (!replayed && body.data.use_cart) {
      const cart = getCart(req.user!.id);

      db.prepare("DELETE FROM cart_items WHERE cart_id=?").run(cart.id);
    }

    audit(req.user!.id, "order.create", String((order as Record<string, unknown>).id), "ALLOWED");

    return res.status(replayed ? 200 : 201).json({ order, replayed });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

/** GET /orders — danh sách đơn (CUSTOMER chỉ thấy đơn của mình). */
ordersRouter.get("/", auth, requirePermission("order.read"), (req: AuthedRequest, res) => {
  return res.json(listOrders(req.user!));
});

/** GET /orders/:id — chi tiết một đơn, có kiểm tra quyền sở hữu. */
ordersRouter.get("/:id", auth, requirePermission("order.read"), (req: AuthedRequest, res) => {
  try {
    return res.json(getOrderById(req.params.id, req.user!));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

/** POST /orders/:id/cancel — hủy đơn PENDING, cần confirm=true. */
ordersRouter.post(
  "/:id/cancel",
  auth,
  requirePermission("order.cancel"),
  (req: AuthedRequest, res) => {
    try {
      const order = cancelOrder(req.params.id, req.user!, req.body?.confirm);

      return res.json(order);
    } catch (error) {
      return handleRouteError(res, error);
    }
  },
);

/** PATCH /orders/:id/address — đổi địa chỉ giao hàng, cần confirm=true. */
ordersRouter.patch("/:id/address", auth, (req: AuthedRequest, res) => {
  const body = z.object({ shipping_address: z.string(), confirm: z.boolean() }).safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Dữ liệu không hợp lệ.");
  }

  try {
    const order = updateOrderAddress(
      req.params.id,
      req.user!,
      body.data.shipping_address,
      body.data.confirm,
    );

    return res.json(order);
  } catch (error) {
    return handleRouteError(res, error);
  }
});
