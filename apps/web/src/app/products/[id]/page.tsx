// Trang chi tiết sản phẩm: chọn biến thể rồi thêm vào giỏ.
"use client";

import { use, useEffect, useState } from "react";

import { api, money } from "../../../lib/api";

export default function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [p, setP] = useState<any>(null);
  const [variant, setVariant] = useState("");

  useEffect(() => {
    api(`/products/${id}`)
      .then((d) => {
        setP(d);
        setVariant(d.variants?.[0]?.id || "");
      })
      .catch(() => {});
  }, [id]);

  if (!p) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Đang tải...</span>
        </div>
      </div>
    );
  }

  const addToCart = async () => {
    try {
      await api("/cart/items", {
        method: "POST",
        body: JSON.stringify({ variant_id: variant, quantity: 1 }),
      });

      alert("Đã thêm vào giỏ!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h1 className="card-title h3">{p.name}</h1>
        <p className="card-text text-muted">{p.description}</p>
        <p className="fs-4 fw-bold text-primary">{money(p.price)}</p>

        <label className="form-label" htmlFor="variant">
          Biến thể
        </label>
        <select
          id="variant"
          className="form-select mb-3"
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
        >
          {p.variants?.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.attributes} — tồn kho: {v.stock_quantity} — {money(v.price)}
            </option>
          ))}
        </select>

        <button className="btn btn-primary" onClick={addToCart}>
          🛒 Thêm vào giỏ
        </button>
      </div>
    </div>
  );
}
