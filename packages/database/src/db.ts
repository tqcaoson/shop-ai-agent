// Database runtime — chế độ local: SQLite qua node:sqlite (Node >= 22),
// không cần cài thêm gì. Bảng trong file này khớp với schema Prisma
// ở prisma/schema.prisma; chế độ Docker thì đổi sang Prisma + Postgres.
//
// Lấy builtin bằng process.getBuiltinModule thay vì import tĩnh, vì
// Vite/Vitest hay phân giải "node:sqlite" thành package "sqlite" rồi lỗi.
import fs from "node:fs";
import path from "node:path";

const proc = process as unknown as {
  getBuiltinModule?: (id: string) => { DatabaseSync: new (path: string) => unknown };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqliteMod =
  typeof proc.getBuiltinModule === "function"
    ? proc.getBuiltinModule("node:sqlite")
    : require("node:sqlite");

const DatabaseSync = sqliteMod.DatabaseSync as new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
};

// Vị trí file database lấy từ DATABASE_URL (dạng "file:./shop.db"),
// mặc định là file shop.db trong thư mục chạy API.
const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") || "./shop.db";
const resolved = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

fs.mkdirSync(path.dirname(resolved), { recursive: true });

export const db = new DatabaseSync(resolved);

/**
 * Tạo toàn bộ bảng nếu chưa có, rồi nạp vai trò và quyền mặc định.
 * Chạy lại nhiều lần cũng an toàn vì dùng CREATE TABLE IF NOT EXISTS
 * và INSERT OR IGNORE.
 */
export function initDb() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'ACTIVE', created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, description TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS user_roles (user_id TEXT NOT NULL, role_id TEXT NOT NULL, PRIMARY KEY(user_id, role_id));
  CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL, permission_id TEXT NOT NULL, PRIMARY KEY(role_id, permission_id));
  CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', price INTEGER NOT NULL, status TEXT DEFAULT 'ACTIVE', category_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS product_variants (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, sku TEXT UNIQUE NOT NULL, attributes TEXT DEFAULT '{}', price INTEGER NOT NULL, stock_quantity INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS carts (id TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS cart_items (id TEXT PRIMARY KEY, cart_id TEXT NOT NULL, variant_id TEXT NOT NULL, quantity INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, order_number TEXT UNIQUE NOT NULL, total_amount INTEGER NOT NULL, status TEXT DEFAULT 'PENDING', shipping_address TEXT DEFAULT '', created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, variant_id TEXT NOT NULL, product_name_snapshot TEXT NOT NULL, unit_price_snapshot INTEGER NOT NULL, quantity INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS agent_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS agent_messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS agent_audit_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, authorization_result TEXT NOT NULL, execution_result TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS knowledge_documents (id TEXT PRIMARY KEY, shop_id TEXT DEFAULT 'shop-001', title TEXT NOT NULL, category TEXT NOT NULL, version INTEGER DEFAULT 1, status TEXT DEFAULT 'ACTIVE');
  CREATE TABLE IF NOT EXISTS knowledge_chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, metadata TEXT DEFAULT '{}', vector_point_id TEXT);
  CREATE TABLE IF NOT EXISTS ai_usage_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, shop_id TEXT DEFAULT 'shop-001', model TEXT NOT NULL, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, estimated_cost REAL NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS agent_idempotency_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, action TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id, idempotency_key, action));
  `);

  // Quyền mặc định của shop, kèm mô tả tiếng Việt.
  const permissions: [string, string][] = [
    ["product.read", "Xem sản phẩm"],
    ["product.write", "Quản lý sản phẩm"],
    ["order.read", "Xem đơn hàng"],
    ["order.create", "Tạo đơn hàng"],
    ["order.cancel", "Hủy đơn hàng"],
    ["order.manage", "Quản lý đơn hàng"],
    ["user.manage", "Quản lý người dùng"],
    ["agent.use", "Dùng AI Agent"],
  ];

  for (const [code, description] of permissions) {
    db.prepare("INSERT OR IGNORE INTO permissions (id, code, description) VALUES (?, ?, ?)").run(
      `perm-${code}`,
      code,
      description,
    );
  }

  for (const role of ["ADMIN", "STAFF", "CUSTOMER"]) {
    db.prepare("INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)").run(`role-${role}`, role);
  }

  const grant = (role: string, codes: string[]) => {
    for (const code of codes) {
      db.prepare(
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
         SELECT ?, id FROM permissions WHERE code = ?`,
      ).run(`role-${role}`, code);
    }
  };

  // ADMIN có toàn bộ quyền, STAFF quản lý sản phẩm và đơn hàng,
  // CUSTOMER chỉ mua hàng và quản lý đơn của mình.
  grant(
    "ADMIN",
    permissions.map((permission) => permission[0]),
  );
  grant("STAFF", ["product.read", "product.write", "order.read", "order.manage", "agent.use"]);
  grant("CUSTOMER", ["product.read", "order.read", "order.create", "order.cancel", "agent.use"]);
}

/** Tạo id ngẫu nhiên, dạng ngắn gọn, đủ duy nhất cho MVP. */
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Thời gian hiện tại theo chuẩn ISO, dùng chung cho các cột created_at. */
export const nowIso = () => new Date().toISOString();

/** Lấy toàn bộ mã quyền của một người dùng qua các vai trò của họ. */
export function userPermissions(userId: string): string[] {
  const rows = db
    .prepare(
      `
      SELECT p.code FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = ?`,
    )
    .all(userId) as { code: string }[];

  return [...new Set(rows.map((row) => row.code))];
}

/** Lấy danh sách vai trò của một người dùng. */
export function userRoles(userId: string): string[] {
  const rows = db
    .prepare(
      `
      SELECT r.name FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?`,
    )
    .all(userId) as { name: string }[];

  return rows.map((row) => row.name);
}
