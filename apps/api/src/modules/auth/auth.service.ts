// Service xác thực: đăng ký, đăng nhập, cấp JWT.
//
// Service chỉ làm việc với database và trả về dữ liệu thuần,
// không biết gì về Request/Response của Express. Việc kiểm tra
// định dạng đầu vào (zod) nằm ở route.
import { db, nowIso, uid, userRoles } from "../../../../../packages/database/src/db";
import { hashPassword, signJwt, verifyPassword } from "../../../../../packages/security/src/auth";
import { config } from "../../config";
import { HttpError } from "../../lib/errors";

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
  };
}

/**
 * Đăng ký tài khoản mới với vai trò CUSTOMER.
 * Email đã tồn tại thì báo lỗi 409.
 */
export function registerUser(email: string, password: string, name: string): AuthResult {
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(email);

  if (exists) {
    throw new HttpError(409, "Email đã tồn tại.");
  }

  const id = uid();

  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)",
  ).run(id, email, hashPassword(password), name, nowIso());

  db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, 'role-CUSTOMER')").run(id);

  const token = signJwt({ sub: id }, config.jwtSecret);

  return { token, user: { id, email, name, roles: ["CUSTOMER"] } };
}

/**
 * Đăng nhập bằng email và mật khẩu.
 * Sai email hoặc sai mật khẩu đều trả về cùng một lỗi 401,
 * để không lộ ra email nào đã được đăng ký.
 */
export function loginUser(email: string, password: string): AuthResult {
  const row = db.prepare("SELECT * FROM users WHERE email=?").get(email) as
    Record<string, string> | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new HttpError(401, "Email hoặc mật khẩu sai.");
  }

  const token = signJwt({ sub: row.id }, config.jwtSecret);

  return {
    token,
    user: { id: row.id, email: row.email, name: row.name, roles: userRoles(row.id) },
  };
}
