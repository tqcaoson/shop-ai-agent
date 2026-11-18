"use client";

import { useEffect, useState } from "react";

import { api, money } from "../../lib/api";

export default function Admin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState("Sản phẩm mới");
  const [price, setPrice] = useState(100000);

  useEffect(() => {
    api("/orders")
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  const createProduct = async () => {
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify({ name, price }),
      });

      alert("Tạo xong!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <main>
      <h1>Quản trị</h1>

      <p>Cần đăng nhập bằng admin@shop.local hoặc staff@shop.local.</p>

      <h2>Tạo sản phẩm</h2>

      <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 8 }} />

      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        style={{ padding: 8, marginLeft: 8 }}
      />

      <button style={{ marginLeft: 8 }} onClick={createProduct}>
        Tạo
      </button>

      <h2>Đơn hàng</h2>

      {orders.map((o) => (
        <p key={o.id}>
          {o.order_number} — {o.status} — {money(o.total_amount)}
        </p>
      ))}
    </main>
  );
}
