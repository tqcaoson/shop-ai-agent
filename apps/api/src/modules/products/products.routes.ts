// Route sản phẩm: xem danh sách, xem chi tiết, tạo và cập nhật.
import { Router } from "express";
import { z } from "zod";

import { auth, requirePermission, type AuthedRequest } from "../../lib/middleware";
import { handleRouteError, sendError } from "../../lib/errors";
import { createProduct, getProductById, listProducts, updateProduct } from "./products.service";

export const productsRouter = Router();

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  price: z.number().int().positive(),
  category_id: z.string().optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().int().positive().optional(),
  status: z.string().optional(),
});

/** GET /products — danh sách sản phẩm, hỗ trợ ?q=... và ?category=... */
productsRouter.get("/", (_req, res) => {
  const query = String(_req.query.q || "");
  const category = String(_req.query.category || "");

  return res.json(listProducts(query, category));
});

/** GET /products/:id — chi tiết một sản phẩm kèm biến thể. */
productsRouter.get("/:id", async (req, res) => {
  const product = await getProductById(req.params.id);

  if (!product) {
    return sendError(res, 404, "Không tìm thấy sản phẩm.");
  }

  return res.json(product);
});

/** POST /products — tạo sản phẩm mới (ADMIN/STAFF). */
productsRouter.post("/", auth, requirePermission("product.write"), (req: AuthedRequest, res) => {
  const body = createProductSchema.safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Dữ liệu không hợp lệ.");
  }

  // safeParse ở trên đã kiểm tra name và price bắt buộc phải có.
  // Dấu ! chỉ để qua kiểm tra kiểu của zod 3.25 (nó suy luận mọi
  // thuộc tính của object thành optional).
  const product = createProduct(
    {
      name: body.data.name!,
      description: body.data.description ?? "",
      price: body.data.price!,
      category_id: body.data.category_id,
    },
    req.user!.id,
  );

  return res.status(201).json(product);
});

/** PUT /products/:id — cập nhật sản phẩm (ADMIN/STAFF). */
productsRouter.put("/:id", auth, requirePermission("product.write"), async (req, res) => {
  const body = updateProductSchema.safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Dữ liệu không hợp lệ.");
  }

  try {
    const product = await updateProduct(req.params.id, body.data);

    return res.json(product);
  } catch (error) {
    return handleRouteError(res, error);
  }
});
