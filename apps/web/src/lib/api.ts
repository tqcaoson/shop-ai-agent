// Hàm gọi API dùng chung cho toàn bộ trang web.
//
// Token đăng nhập được lưu trong localStorage sau khi đăng nhập xong,
// và được gắn vào header Authorization của mọi request.
// Khi đăng nhập/đăng xuất, một sự kiện "auth-changed" được bắn ra để
// thanh điều hướng (Nav) cập nhật ngay mà không cần tải lại trang.
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

/** Đọc token đã lưu (rỗng nếu chưa đăng nhập). */
export function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
}

/** Đọc thông tin user đã lưu lúc đăng nhập (null nếu chưa đăng nhập). */
export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/** Lưu token + user sau khi đăng nhập, báo cho Nav cập nhật. */
export function saveAuth(token: string, user: StoredUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  window.dispatchEvent(new Event("auth-changed"));
}

/** Xoá token + user khi đăng xuất, báo cho Nav cập nhật. */
export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth-changed"));
}

export async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
      ...(init.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Lỗi ${res.status}`);
  }

  return data;
}

/** Định dạng số tiền theo kiểu Việt Nam, ví dụ: 199.000 VND. */
export const money = (n: number) => n.toLocaleString("vi-VN") + " VND";
