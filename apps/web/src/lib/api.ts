// Hàm gọi API dùng chung cho toàn bộ trang web.
//
// Token đăng nhập được lưu trong localStorage sau khi đăng nhập xong,
// và được gắn vào header Authorization của mọi request.
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
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
