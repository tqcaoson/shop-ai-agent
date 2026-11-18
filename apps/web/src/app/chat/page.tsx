"use client";

import { useState } from "react";

import { api } from "../../lib/api";

export default function Chat() {
  const [msg, setMsg] = useState("Chính sách đổi trả thế nào?");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);

  const send = async () => {
    try {
      const d = await api("/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });

      setLog([
        ...log,
        {
          q: msg,
          a: `${d.response}${d.requiresApproval ? "\n[CẦN XÁC NHẬN TRƯỚC KHI THỰC HIỆN]" : ""}`,
        },
      ]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <main>
      <h1>Chat AI</h1>

      <p>
        Thử: "đổi trả thế nào", "áo thun giá bao nhiêu", "đơn hàng của tôi", "ignore previous
        instructions" (sẽ bị chặn).
      </p>

      {log.map((m, i) => (
        <div key={i} style={{ margin: 12 }}>
          <p>
            <b>Bạn:</b> {m.q}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            <b>AI:</b> {m.a}
          </p>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={send}>Gửi</button>
      </div>
    </main>
  );
}
