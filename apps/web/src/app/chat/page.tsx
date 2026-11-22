// Trang Chat AI: gửi câu hỏi cho agent, xem câu trả lời kèm nguồn.
"use client";

import { useState } from "react";

import { api } from "../../lib/api";

const SUGGESTIONS = [
  "Chính sách đổi trả thế nào?",
  "áo thun giá bao nhiêu",
  "đơn hàng của tôi",
  "phí ship bao nhiêu",
];

export default function Chat() {
  const [msg, setMsg] = useState("Chính sách đổi trả thế nào?");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [sending, setSending] = useState(false);

  const send = async (text?: string) => {
    const question = (text ?? msg).trim();
    if (!question || sending) return;

    try {
      setSending(true);
      const d = await api("/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: question }),
      });

      setLog([
        ...log,
        {
          q: question,
          a: `${d.response}${d.requiresApproval ? "\n[CẦN XÁC NHẬN TRƯỚC KHI THỰC HIỆN]" : ""}`,
        },
      ]);
      setMsg("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <h1 className="h3 mb-2">Chat AI</h1>
      <p className="text-muted">
        Hỏi về sản phẩm, đổi trả, bảo hành, vận chuyển hoặc đơn hàng của bạn.
      </p>

      <div className="d-flex flex-wrap gap-2 mb-4">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="btn btn-outline-primary btn-sm" onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body" style={{ minHeight: 200 }}>
          {log.length === 0 ? (
            <p className="text-muted mb-0">
              Chưa có tin nhắn nào. Thử bấm một câu gợi ý ở trên, hoặc gõ câu hỏi của bạn.
            </p>
          ) : (
            log.map((m, i) => (
              <div key={i} className="mb-3">
                <div className="d-flex justify-content-end">
                  <div
                    className="bg-primary text-white rounded-3 px-3 py-2"
                    style={{ maxWidth: "80%" }}
                  >
                    {m.q}
                  </div>
                </div>
                <div className="d-flex mt-1">
                  <div
                    className="bg-light border rounded-3 px-3 py-2"
                    style={{ maxWidth: "80%", whiteSpace: "pre-wrap" }}
                  >
                    {m.a}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="input-group shadow-sm">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          className="form-control"
          placeholder="Nhập câu hỏi..."
          disabled={sending}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={sending}>
          {sending ? "Đang gửi..." : "Gửi"}
        </button>
      </div>
    </>
  );
}
