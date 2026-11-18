"use client";

import { useEffect, useState } from "react";

import { api, money } from "../../lib/api";

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);

  const load = () => {
    api("/orders")
      .then(setOrders)
      .catch(() => setOrders([]));
  };

  useEffect(() => {
    load();
  }, []);

  const cancelOrder = async (orderId: string) => {
    await api(`/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });

    load();
  };

  return (
    <main>
      <h1>Đơn hàng của tôi</h1>

      {orders.map((o) => (
        <div key={o.id} style={{ border: "1px solid #ddd", padding: 12, margin: 8 }}>
          <p>
            <b>{o.order_number}</b> — {o.status} — {money(o.total_amount)}
          </p>
          <p>{o.shipping_address}</p>

          {o.status === "PENDING" && <button onClick={() => cancelOrder(o.id)}>Huỷ đơn</button>}
        </div>
      ))}

      {!orders.length && <p>Chưa có đơn hàng nào (hoặc cần đăng nhập).</p>}
    </main>
  );
}
