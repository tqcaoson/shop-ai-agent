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
    return <p>Đang tải...</p>;
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
    <main>
      <h1>{p.name}</h1>
      <p>{p.description}</p>
      <p>{money(p.price)}</p>

      <select value={variant} onChange={(e) => setVariant(e.target.value)}>
        {p.variants?.map((v: any) => (
          <option key={v.id} value={v.id}>
            {v.attributes} — tồn kho: {v.stock_quantity} — {money(v.price)}
          </option>
        ))}
      </select>

      <button style={{ marginLeft: 8 }} onClick={addToCart}>
        Thêm vào giỏ
      </button>
    </main>
  );
}
