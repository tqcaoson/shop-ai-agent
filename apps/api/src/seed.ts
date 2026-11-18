// Seed dữ liệu mẫu cho lần chạy đầu tiên.
//
// Chạy lại cũng an toàn: nếu bảng users đã có dữ liệu thì seed bỏ qua.
// Tên và mô tả sản phẩm viết bằng tiếng Việt có dấu; việc tìm kiếm
// đã chuẩn hoá (bỏ dấu) ở tầng service nên gõ "ao thun" hay "áo thun"
// đều tìm được.
import { db, initDb, nowIso, uid } from "../../../packages/database/src/db";
import { hashPassword } from "../../../packages/security/src/auth";

/** Tài khoản mẫu: email, tên hiển thị, mật khẩu, vai trò. */
const SEED_USERS: { email: string; name: string; password: string; role: string }[] = [
  { email: "admin@shop.local", name: "Admin", password: "Admin123!", role: "ADMIN" },
  { email: "staff@shop.local", name: "Nhân viên", password: "Staff123!", role: "STAFF" },
  { email: "customer@shop.local", name: "Khách hàng", password: "Customer123!", role: "CUSTOMER" },
];

/** Danh mục mẫu: id, tên hiển thị. */
const SEED_CATEGORIES: [string, string][] = [
  ["ao", "Áo"],
  ["quan", "Quần"],
  ["giay", "Giày"],
  ["phu-kien", "Phụ kiện"],
];

interface SeedProduct {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  /** Mỗi biến thể là một cặp [size, số lượng tồn kho]. */
  sizes: [string, number][];
}

/** Sản phẩm mẫu kèm biến thể theo size và tồn kho từng biến thể. */
const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: "Áo thun cotton trắng",
    description: "Áo thun cotton 100%, thoáng mát, form regular.",
    price: 199000,
    categoryId: "ao",
    sizes: [
      ["S", 50],
      ["M", 30],
      ["L", 20],
    ],
  },
  {
    name: "Áo sơ mi linen",
    description: "Sơ mi linen nhẹ, phù hợp mùa hè.",
    price: 349000,
    categoryId: "ao",
    sizes: [
      ["M", 25],
      ["L", 25],
    ],
  },
  {
    name: "Quần jeans slim",
    description: "Jeans co giãn nhẹ, ống slim.",
    price: 499000,
    categoryId: "quan",
    sizes: [
      ["30", 20],
      ["32", 20],
    ],
  },
  {
    name: "Giày sneaker trắng",
    description: "Sneaker đế cao su, đi hằng ngày.",
    price: 799000,
    categoryId: "giay",
    sizes: [
      ["41", 15],
      ["42", 15],
      ["43", 10],
    ],
  },
  {
    name: "Túi xách canvas",
    description: "Túi canvas bền, đựng được laptop 13 inch.",
    price: 299000,
    categoryId: "phu-kien",
    sizes: [["OneSize", 40]],
  },
  {
    name: "Áo hoodie nỉ",
    description: "Hoodie nỉ dày, ấm, có mũ.",
    price: 449000,
    categoryId: "ao",
    sizes: [
      ["M", 20],
      ["L", 20],
    ],
  },
  {
    name: "Quần short kaki",
    description: "Short kaki nhẹ, túi sau có nút.",
    price: 249000,
    categoryId: "quan",
    sizes: [
      ["M", 30],
      ["L", 30],
    ],
  },
  {
    name: "Mũ lưỡi trai",
    description: "Mũ lưỡi trai cotton, điều chỉnh được.",
    price: 149000,
    categoryId: "phu-kien",
    sizes: [["OneSize", 60]],
  },
];

/** Tạo một người dùng mẫu và gán vai trò cho người đó. */
function seedUser(email: string, name: string, password: string, role: string): void {
  const id = uid();

  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)",
  ).run(id, email, hashPassword(password), name, nowIso());

  db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(id, `role-${role}`);
}

/** Tạo một sản phẩm mẫu kèm toàn bộ biến thể của nó. */
function seedProduct(product: SeedProduct): void {
  const productId = uid();

  db.prepare(
    "INSERT INTO products (id, name, description, price, status, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)",
  ).run(
    productId,
    product.name,
    product.description,
    product.price,
    product.categoryId,
    nowIso(),
    nowIso(),
  );

  for (const [size, stock] of product.sizes) {
    db.prepare(
      "INSERT INTO product_variants (id, product_id, sku, attributes, price, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      uid(),
      productId,
      `${productId.toUpperCase()}-${size}`,
      JSON.stringify({ size }),
      product.price,
      stock,
    );
  }
}

/**
 * Nạp dữ liệu mẫu vào database.
 * Chỉ chạy khi bảng users đang trống, để chạy lại không tạo trùng dữ liệu.
 */
export function seed(): void {
  initDb();

  const count = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;

  if (count > 0) {
    return;
  }

  for (const user of SEED_USERS) {
    seedUser(user.email, user.name, user.password, user.role);
  }

  for (const [id, name] of SEED_CATEGORIES) {
    db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run(id, name);
  }

  for (const product of SEED_PRODUCTS) {
    seedProduct(product);
  }
}
