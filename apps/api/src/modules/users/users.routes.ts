// Route quản lý người dùng (chỉ ADMIN).
import { Router } from "express";

import { db, userRoles } from "../../../../../packages/database/src/db";
import { auth, requirePermission } from "../../lib/middleware";

export const usersRouter = Router();

/** GET /users — danh sách người dùng kèm vai trò của từng người. */
usersRouter.get("/", auth, requirePermission("user.manage"), (_req, res) => {
  const rows = db.prepare("SELECT id, email, name, status, created_at FROM users").all();

  const users = rows.map((user: Record<string, unknown>) => ({
    ...user,
    roles: userRoles(String(user.id)),
  }));

  return res.json(users);
});
