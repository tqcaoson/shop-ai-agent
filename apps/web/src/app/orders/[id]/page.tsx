"use client";
// Trang chi tiết đơn hàng: GET /orders/:id, hủy đơn PENDING.
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, money } from "../../../lib/api";

type OrderItem = {
  id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  shipping_address: string;
  created_at: string;
  items: OrderItem[];
};

const statusBadge: Record<string, string> = {
  PENDING: "bg-warning text-dark",
  CONFIRMED: "bg-info text-dark",
  SHIPPING: "bg-primary",
  DELIVERED: "bg-success",
  CANCELLED: "bg-secondary",
};

const statusLabel: Record<string, string> = {
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/orders/${id}`)
      .then(setOrder)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function cancelOrder() {
    if (!confirm("Bạn có chắc muốn hủy đơn này không?")) return;
    try {
      const updated = await api(`/orders/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      // API hủy đơn chỉ trả về đơn hàng, không kèm items — chỉ cập
      // nhật trạng thái, giữ lại danh sách sản phẩm đang hiển thị.
      setOrder((prev) => (prev ? { ...prev, status: updated.status } : updated));
      alert("Đã hủy đơn hàng.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hủy đơn thất bại.");
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <div className="alert alert-danger">{error || "Không tìm thấy đơn hàng."}</div>
        <Link href="/orders" className="btn btn-outline-secondary">
          Về danh sách đơn
        </Link>
      </div>
    );
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Đơn {order.order_number}</h2>
          <span className={`badge ${statusBadge[order.status] || "bg-secondary"}`}>
            {statusLabel[order.status] || order.status}
          </span>
        </div>
        <div className="card mb-3">
          <div className="card-body">
            <dl className="row mb-0">
              <dt className="col-sm-4">Ngày đặt</dt>
              <dd className="col-sm-8">{new Date(order.created_at).toLocaleString("vi-VN")}</dd>
              <dt className="col-sm-4">Địa chỉ giao hàng</dt>
              <dd className="col-sm-8">{order.shipping_address}</dd>
              <dt className="col-sm-4">Tổng tiền</dt>
              <dd className="col-sm-8 fw-bold">{money(order.total_amount)}</dd>
            </dl>
          </div>
        </div>
        <h5>Sản phẩm</h5>
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th className="text-end">Đơn giá</th>
              <th className="text-end">Số lượng</th>
              <th className="text-end">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name_snapshot}</td>
                <td className="text-end">{money(item.unit_price_snapshot)}</td>
                <td className="text-end">{item.quantity}</td>
                <td className="text-end">{money(item.unit_price_snapshot * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="d-flex gap-2">
          <Link href="/orders" className="btn btn-outline-secondary">
            Về danh sách đơn
          </Link>
          {order.status === "PENDING" && (
            <button className="btn btn-danger" onClick={cancelOrder}>
              Huỷ đơn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
