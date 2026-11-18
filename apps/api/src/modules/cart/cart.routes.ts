// Route giỏ hàng: xem giỏ, thêm món, xóa món.
import { Router } from "express";
import { z } from "zod";

import { auth, type AuthedRequest } from "../../lib/middleware";
import { sendError } from "../../lib/errors";
import { addCartItem, getCart, removeCartItem } from "./cart.service";

export const cartRouter = Router();

const addItemSchema = z.object({
  variant_id: z.string(),
  quantity: z.number().int().positive(),
});

/** GET /cart — giỏ hàng của người dùng đang đăng nhập. */
cartRouter.get("/", auth, (req: AuthedRequest, res) => {
  return res.json(getCart(req.user!.id));
});

/** POST /cart/items — thêm một biến thể vào giỏ. */
cartRouter.post("/items", auth, (req: AuthedRequest, res) => {
  const body = addItemSchema.safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Dữ liệu không hợp lệ.");
  }

  return res.json(addCartItem(req.user!.id, body.data.variant_id, body.data.quantity));
});

/** DELETE /cart/items/:id — xóa một dòng khỏi giỏ. */
cartRouter.delete("/items/:id", auth, (req: AuthedRequest, res) => {
  return res.json(removeCartItem(req.user!.id, req.params.id));
});
