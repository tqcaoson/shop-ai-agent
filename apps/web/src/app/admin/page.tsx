// Trang quản trị: tạo sản phẩm mới và xem tất cả đơn hàng.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, getStoredUser, money } from "../../lib/api";

export default function Admin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState("Sản phẩm mới");
  const [price, setPrice] = useState(100000);
  // Chỉ ADMIN/STAFF mới thấy trang này. Đây là chặn ở giao diện cho
  // đỡ nhầm lẫn; API vẫn là nơi chặn thật (trả 403 khi thiếu quyền
  // product.write), kể cả khi ai đó sửa dữ liệu lưu trong trình duyệt.
  const [canManage, setCanManage] = useState<boolean | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    const allowed = !!user?.roles?.some((role) => role === "ADMIN" || role === "STAFF");
    setCanManage(allowed);
    if (allowed) {
      api("/orders")
        .then(setOrders)
        .catch(() => setOrders([]));
    }
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

  if (canManage === null) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="h3 mb-3">Quản trị</h1>
        <div className="alert alert-danger">
          Bạn không có quyền truy cập trang này. Chỉ tài khoản ADMIN hoặc STAFF mới được vào quản
          trị.
        </div>
        <Link href="/" className="btn btn-outline-secondary">
          Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="h3 mb-2">Quản trị</h1>
      <p className="text-muted">Cần đăng nhập bằng admin@shop.local hoặc staff@shop.local.</p>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5 card-title">Tạo sản phẩm</h2>
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label" htmlFor="productName">
                Tên sản phẩm
              </label>
              <input
                id="productName"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="productPrice">
                Giá (VND)
              </label>
              <input
                id="productPrice"
                type="number"
                className="form-control"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-primary w-100" onClick={createProduct}>
                Tạo
              </button>
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-3">Đơn hàng</h2>

      {orders.length === 0 ? (
        <div className="alert alert-info">Chưa có đơn hàng nào.</div>
      ) : (
        <div className="card shadow-sm">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Mã đơn</th>
                <th>Trạng thái</th>
                <th className="text-end">Tổng tiền</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="fw-bold">{o.order_number}</td>
                  <td>{o.status}</td>
                  <td className="text-end">{money(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
