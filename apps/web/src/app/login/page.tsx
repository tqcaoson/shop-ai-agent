"use client";

import { useState } from "react";

import { api } from "../../lib/api";

export default function Login() {
  const [email, setEmail] = useState("customer@shop.local");
  const [password, setPassword] = useState("Customer123!");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const submit = async () => {
    try {
      const data = await api(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name: name || "Khách" }),
      });

      localStorage.setItem("token", data.token);

      alert("Đăng nhập xong, vào trang Sản phẩm nhé!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <main>
      <h1>{mode === "login" ? "Đăng nhập" : "Đăng ký"}</h1>

      {mode === "register" && (
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Họ tên"
            style={{ display: "block", margin: 8, padding: 8 }}
          />
        </div>
      )}

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        style={{ display: "block", margin: 8, padding: 8 }}
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu"
        style={{ display: "block", margin: 8, padding: 8 }}
      />

      <button onClick={submit}>Xác nhận</button>

      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        style={{ marginLeft: 8 }}
      >
        Đổi sang {mode === "login" ? "Đăng ký" : "Đăng nhập"}
      </button>
    </main>
  );
}
