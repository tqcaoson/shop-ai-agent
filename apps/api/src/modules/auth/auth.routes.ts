// Route xác thực: đăng ký, đăng nhập, xem thông tin của chính mình.
import { Router } from "express";
import { z } from "zod";

import { auth, rateLimit, type AuthedRequest } from "../../lib/middleware";
import { handleRouteError, sendError } from "../../lib/errors";
import { loginUser, registerUser } from "./auth.service";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/** POST /auth/register — tạo tài khoản CUSTOMER mới. */
authRouter.post("/register", rateLimit(20, 60_000), (req, res) => {
  const body = registerSchema.safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Dữ liệu không hợp lệ.");
  }

  try {
    const result = registerUser(body.data.email, body.data.password, body.data.name);

    return res.status(201).json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

/** POST /auth/login — đăng nhập và nhận JWT. */
authRouter.post("/login", rateLimit(20, 60_000), (req, res) => {
  const body = loginSchema.safeParse(req.body);

  if (!body.success) {
    return sendError(res, 400, "Dữ liệu không hợp lệ.");
  }

  try {
    const result = loginUser(body.data.email, body.data.password);

    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

/** GET /auth/me — thông tin người dùng đang đăng nhập. */
authRouter.get("/me", auth, (req: AuthedRequest, res) => {
  return res.json({ user: req.user });
});
