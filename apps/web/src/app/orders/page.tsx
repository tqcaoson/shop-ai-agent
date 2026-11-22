// Trang đơn hàng của tôi: liệt kê đơn, huỷ đơn đang chờ xử lý.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, getToken, money } from "../../lib/api";

/** Màu badge theo trạng thái đơn hàng. */
const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-warning text-dark",
  CONFIRMED: "bg-info text-dark",
  SHIPPING: "bg-primary",
  DELIVERED: "bg-success",
  CANCELLED: "bg-secondary",
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loggedIn, setLoggedIn] = useState(true);

  const load = () => {
    setLoggedIn(!!getToken());
    api("/orders")
      .then(setOrders)
      .catch(() => setOrders([]));
  };

  useEffect(() => {
    load();
  }, []);

  const cancelOrder = async (orderId: string) => {
    if (!confirm("Bạn có chắc muốn hủy đơn này không?")) return;
    try {
      await api(`/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });

      alert("Đã hủy đơn hàng.");
      load();
    } catch (e: any) {
      alert(e.message || "Hủy đơn thất bại.");
    }
  };

  return (
    <>
      <h1 className="h3 mb-4">Đơn hàng của tôi</h1>

      {orders.length === 0 ? (
        loggedIn ? (
          <div className="alert alert-info">Chưa có đơn hàng nào.</div>
        ) : (
          <div className="alert alert-warning">
            Cần đăng nhập để xem đơn hàng.{" "}
            <Link href="/login" className="alert-link">
              Đăng nhập
            </Link>
          </div>
        )
      ) : (
        <div className="row g-3">
          {orders.map((o) => (
            <div className="col-12" key={o.id}>
              <div className="card shadow-sm">
                <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <span className="fw-bold">{o.order_number}</span>{" "}
                    <span className={`badge ${STATUS_BADGE[o.status] || "bg-secondary"}`}>
                      {STATUS_TEXT[o.status] || o.status}
                    </span>
                    <div className="text-muted small">{o.shipping_address}</div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <span className="fs-5 fw-bold text-primary">{money(o.total_amount)}</span>
                    <Link href={`/orders/${o.id}`} className="btn btn-outline-primary btn-sm">
                      Xem chi tiết
                    </Link>
                    {o.status === "PENDING" && (
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => cancelOrder(o.id)}
                      >
                        Huỷ đơn
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
