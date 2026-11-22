// Trang giỏ hàng: xem các món đã thêm, nhập địa chỉ và đặt hàng.
"use client";

import Link from "next/link";
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
    return (
      <div className="alert alert-warning">
        Cần đăng nhập để xem giỏ hàng.{" "}
        <Link href="/login" className="alert-link">
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="h3 mb-4">Giỏ hàng</h1>

      {cart.items.length === 0 ? (
        <div className="alert alert-info">
          Giỏ hàng đang trống. Vào trang Sản phẩm để thêm hàng.
        </div>
      ) : (
        <div className="card shadow-sm mb-4">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Sản phẩm</th>
                <th className="text-center">Số lượng</th>
                <th className="text-end">Thành tiền</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.items.map((i: any) => (
                <tr key={i.id}>
                  <td>{i.product_name}</td>
                  <td className="text-center">{i.quantity}</td>
                  <td className="text-end">{money(i.price * i.quantity)}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={async () => {
                        await api(`/cart/items/${i.id}`, { method: "DELETE" });
                        load();
                      }}
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body">
          <p className="fs-5">
            Tổng: <strong className="text-primary">{money(total)}</strong>{" "}
            <span className="text-muted small">(thanh toán giả lập, không thu tiền thật)</span>
          </p>

          <label className="form-label" htmlFor="address">
            Địa chỉ giao hàng
          </label>
          <input
            id="address"
            className="form-control mb-3"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Địa chỉ giao hàng"
          />

          <button className="btn btn-success" onClick={checkout} disabled={cart.items.length === 0}>
            ✅ Đặt hàng (xác nhận)
          </button>
        </div>
      </div>
    </>
  );
}
