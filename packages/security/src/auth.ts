// JWT HS256 tự làm bằng node:crypto — không cần thêm dependency,
// định dạng chuẩn JWT nên các thư viện khác vẫn đọc được.
//
// Mật khẩu được băm bằng scrypt với salt ngẫu nhiên, định dạng lưu
// trong database là "salt:hash".
import crypto from "node:crypto";

/** Mã hóa base64 theo kiểu URL-safe, dùng cho JWT. */
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Ký một JWT mới, mặc định hết hạn sau 7 ngày. */
export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec = 7 * 24 * 3600,
): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec }),
  );
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");

  return `${header}.${body}.${sig}`;
}

/**
 * Kiểm tra chữ ký và hạn của một JWT.
 * Token hợp lệ thì trả về payload, ngược lại trả về null.
 */
export function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  try {
    const [header, body, signature] = token.split(".");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<
      string,
      unknown
    >;

    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/** Băm mật khẩu với salt ngẫu nhiên, trả về chuỗi "salt:hash". */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

/** Kiểm tra mật khẩu người dùng nhập có khớp với hash đã lưu không. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const check = crypto.scryptSync(password, salt, 64).toString("hex");

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(check));
  } catch {
    return false;
  }
}
