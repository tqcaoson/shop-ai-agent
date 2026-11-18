// Middleware dùng chung của API: xác thực JWT, kiểm tra quyền,
// ghi audit log và giới hạn tần suất gọi (rate limit).
//
// Thứ tự kiểm tra của mọi request viết (theo thiết kế trong project.txt):
// xác thực -> phân quyền -> input guard -> kiểm tra quyền từng tool
// -> service nghiệp vụ -> database. LLM không bao giờ chạm trực tiếp vào DB.
import type { NextFunction, Request, Response } from "express";

import { verifyJwt } from "../../../../packages/security/src/auth";
import { db, userPermissions, userRoles } from "../../../../packages/database/src/db";
import { config } from "../config";

/** Request đã gắn thông tin người dùng sau khi qua middleware auth(). */
export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    permissions: string[];
  };
}

/**
 * Xác thực JWT trong header Authorization (dạng "Bearer <token>").
 * Token hợp lệ thì gắn thông tin user (kèm roles và permissions lấy từ DB)
 * vào request để các route phía sau dùng, không tin identity do client tự khai.
 */
export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({ error: "Cần đăng nhập." });
  }

  const payload = verifyJwt(token, config.jwtSecret);

  if (!payload || typeof payload.sub !== "string") {
    return res.status(401).json({ error: "Token không hợp lệ." });
  }

  const row = db.prepare("SELECT id, email, name FROM users WHERE id=?").get(payload.sub) as
    { id: string; email: string; name: string } | undefined;

  if (!row) {
    return res.status(401).json({ error: "Người dùng không tồn tại." });
  }

  req.user = { ...row, roles: userRoles(row.id), permissions: userPermissions(row.id) };

  next();
}

/**
 * Yêu cầu người dùng phải có một quyền cụ thể (ví dụ "product.write").
 * ADMIN luôn được qua, vì ADMIN có toàn bộ quyền của shop.
 * Thiếu quyền thì ghi audit log DENIED rồi trả về 403.
 */
export function requirePermission(code: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(code) && !req.user?.roles.includes("ADMIN")) {
      audit(req.user?.id || "anonymous", `permission:${code}`, "forbidden", "DENIED");

      return res.status(403).json({ error: `Thiếu quyền ${code}.` });
    }

    next();
  };
}

/** Ghi lại một hành động (cho phép hoặc từ chối) vào bảng agent_audit_logs. */
export function audit(userId: string, action: string, resource: string, result: string) {
  db.prepare(
    `INSERT INTO agent_audit_logs (id, user_id, action, resource, authorization_result, execution_result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    action,
    resource,
    result,
    result,
    new Date().toISOString(),
  );
}

// Bộ đếm rate limit theo IP, lưu trong bộ nhớ (MVP).
// Khi chạy production thì đổi sang Redis để đếm chung cho nhiều máy chủ.
const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Giới hạn tối đa `max` request trong mỗi `windowMs` mili-giây cho một IP.
 * Vượt quá thì trả về 429.
 */
export function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const hit = hits.get(key);

    if (!hit || now > hit.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });

      return next();
    }

    hit.count += 1;

    if (hit.count > max) {
      return res.status(429).json({ error: "Quá nhiều yêu cầu, thử lại sau." });
    }

    next();
  };
}
