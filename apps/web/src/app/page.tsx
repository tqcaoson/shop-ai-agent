// Trang chủ: tìm kiếm và liệt kê sản phẩm.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { api, money } from "../lib/api";

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api(`/products?q=${encodeURIComponent(q)}`)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <>
      <div className="p-4 mb-4 bg-primary text-white rounded-3 shadow-sm">
        <h1 className="h3 mb-1">Shop AI Agent</h1>
        <p className="mb-0 opacity-75">
          Tài khoản mẫu: customer@shop.local / Customer123! — admin@shop.local / Admin123!
        </p>
      </div>

      <div className="input-group mb-4 shadow-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Tìm sản phẩm... (ví dụ: áo thun, sneaker)"
          className="form-control"
        />
        <button className="btn btn-primary" onClick={load}>
          🔍 Tìm
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Đang tải...</span>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="alert alert-warning">
          Chưa có sản phẩm — hãy chạy API rồi tải lại trang.
        </div>
      ) : (
        <div className="row g-3">
          {products.map((p) => (
            <div className="col-12 col-sm-6 col-lg-4" key={p.id}>
              <div className="card h-100 shadow-sm">
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title">
                    <Link href={`/products/${p.id}`} className="text-decoration-none">
                      {p.name}
                    </Link>
                  </h5>
                  <p className="card-text text-muted flex-grow-1">{p.description}</p>
                  <p className="card-text">
                    <span className="fs-5 fw-bold text-primary">{money(p.price)}</span>
                  </p>
                  {p.variants?.[0] && (
                    <button
                      className="btn btn-primary mt-auto"
                      onClick={() => add(p.variants[0].id)}
                    >
                      🛒 Thêm vào giỏ (size đầu tiên)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
