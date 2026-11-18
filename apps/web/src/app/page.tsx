"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { api, money } from "../lib/api";

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = () => {
    api(`/products?q=${encodeURIComponent(q)}`)
      .then(setProducts)
      .catch(() => setProducts([]));
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (variantId: string) => {
    try {
      await api("/cart/items", {
        method: "POST",
        body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
      });

      alert("Đã thêm vào giỏ!");
    } catch (e: any) {
      alert(e.message + " (cần đăng nhập trước)");
    }
  };

  return (
    <main>
      <h1>Shop AI Agent</h1>

      <p>Tài khoản mẫu: customer@shop.local / Customer123! — admin@shop.local / Admin123!</p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm sản phẩm..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={load}>Tìm</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 16,
          marginTop: 20,
        }}
      >
        {products.map((p) => (
          <div key={p.id} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
            <Link href={`/products/${p.id}`}>
              <b>{p.name}</b>
            </Link>
            <p>{p.description}</p>
            <p>{money(p.price)}</p>

            {p.variants?.[0] && (
              <button onClick={() => add(p.variants[0].id)}>Thêm vào giỏ (size đầu tiên)</button>
            )}
          </div>
        ))}
      </div>

      {!products.length && <p>Chưa có sản phẩm — hãy chạy API rồi tải lại trang.</p>}
    </main>
  );
}
