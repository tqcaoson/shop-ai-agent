// Trang đăng nhập / đăng ký.
//
// Đăng nhập xong thì lưu token + user (để Nav hiển thị tên và ẩn nút
// Đăng nhập), rồi chuyển về trang Sản phẩm. Nav tự cập nhật qua sự
// kiện "auth-changed", không cần tải lại trang.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api, saveAuth } from "../../lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("customer@shop.local");
  const [password, setPassword] = useState("Customer123!");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setError("");
      const data = await api(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name: name || "Khách" }),
      });

      saveAuth(data.token, data.user);
      router.push("/");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-6 col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body p-4">
            <h1 className="h4 card-title text-center mb-4">
              {mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </h1>

            {error && <div className="alert alert-danger">{error}</div>}

            {mode === "register" && (
              <div className="mb-3">
                <label className="form-label" htmlFor="name">
                  Họ tên
                </label>
                <input
                  id="name"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Họ tên"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="password">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            <button className="btn btn-primary w-100 mb-2" onClick={submit}>
              {mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>

            <button
              className="btn btn-link w-100"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
            </button>

            <div className="alert alert-light border mt-3 mb-0 small text-muted">
              Tài khoản mẫu: <strong>customer@shop.local / Customer123!</strong>
              <br />
              Quản trị: <strong>admin@shop.local / Admin123!</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
