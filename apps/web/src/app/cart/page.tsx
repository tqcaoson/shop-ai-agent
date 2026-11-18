"use client";

import { useEffect, useState } from "react";

import { api, money } from "../../lib/api";

export default function Cart() {
  const [cart, setCart] = useState<any>(null);
  const [address, setAddress] = useState("Hà Nội");

  const load = () => {
    api("/cart")
      .then(setCart)
      .catch(() => setCart(null));
  };

  useEffect(() => {
    load();
  }, []);

  const total = cart?.items?.reduce((s: number, i: any) => s + i.price * i.quantity, 0) || 0;

  const checkout = async () => {
    try {
      const d = await api("/orders", {
        method: "POST",
        headers: { "X-Idempotency-Key": `web-${Date.now()}` },
        body: JSON.stringify({ shipping_address: address, use_cart: true, confirm: true }),
      });

      alert(`Đặt hàng xong! Mã đơn: ${d.order.order_number}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!cart) {
    return <p>Cần đăng nhập để xem giỏ hàng.</p>;
  }

  return (
    <main>
      <h1>Giỏ hàng</h1>

      {cart.items.map((i: any) => (
        <p key={i.id}>
          {i.product_name} x {i.quantity} — {money(i.price * i.quantity)}{" "}
          <button
            onClick={async () => {
              await api(`/cart/items/${i.id}`, { method: "DELETE" });
              load();
            }}
          >
            Xoá
          </button>
        </p>
      ))}

      <p>
        <b>Tổng: {money(total)}</b> (thanh toán giả lập, không thu tiền thật)
      </p>

      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Địa chỉ giao hàng"
        style={{ padding: 8 }}
      />

      <button onClick={checkout} style={{ marginLeft: 8 }}>
        Đặt hàng (xác nhận)
      </button>
    </main>
  );
}
