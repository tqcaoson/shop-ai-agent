// Guardrails — bảo vệ nhiều lớp, không chỉ dùng regex.
//
// 1) Input Guard: giới hạn độ dài + chấm điểm nghi ngờ từ nhiều tín hiệu
//    (câu lệnh, yêu cầu tiết lộ, SQL/shell, chèn lệnh).
// 2) Output Guard: chặn tiết lộ system prompt, chặn thông tin không có
//    căn cứ, chặn dữ liệu của người dùng khác.
export interface GuardResult {
  ok: boolean;
  reason?: string;
  score: number;
}

/**
 * Các dấu hiệu nghi ngờ prompt injection, kèm trọng số.
 * Một tín hiệu riêng lẻ chưa đủ kết luận, phải cộng dồn điểm.
 */
const INJECTION_SIGNALS: [RegExp, number][] = [
  [/ignore (all )?(previous|prior|above) instructions/i, 3],
  [/disregard (your )?(system|previous)/i, 3],
  [/reveal (your )?(system prompt|instructions|prompt)/i, 3],
  [/you are now (a|an|in)/i, 2],
  [/act as (a|an) (?!customer|shop assistant)/i, 1],
  [/do not (follow|obey) (your|the)/i, 2],
  [/bypass|jailbreak|prompt injection/i, 3],
  [/show (me )?(all|other) (users?|orders?|password)/i, 3],
  [/delete (from|all)|drop table|truncate table/i, 3],
  [/;.*(rm -rf|sudo|chmod \+x)/i, 3],
  [/select .* from .* where/i, 2],
  [/\[system\]|\[instruction\]/i, 2],
  [/forget (everything|your rules)/i, 2],
];

/**
 * Kiểm tra tin nhắn đầu vào của người dùng.
 * Điểm nghi ngờ từ 3 trở lên thì chặn, kèm lý do bằng tiếng Việt.
 */
export function inputGuard(text: string): GuardResult {
  if (!text || !text.trim()) {
    return { ok: false, reason: "Tin nhắn rỗng.", score: 0 };
  }

  if (text.length > 2000) {
    return { ok: false, reason: "Tin nhắn vượt quá 2000 ký tự.", score: 0 };
  }

  let score = 0;

  for (const [pattern, weight] of INJECTION_SIGNALS) {
    if (pattern.test(text)) {
      score += weight;
    }
  }

  // Tín hiệu bổ sung: quá nhiều động từ mệnh lệnh trong một tin nhắn.
  const imperative = (text.match(/\b(hay|must|do|execute|run|ignore|reveal|show)\b/gi) || [])
    .length;

  if (imperative >= 5) {
    score += 1;
  }

  if (score >= 3) {
    return {
      ok: false,
      reason:
        "Yêu cầu bị chặn bởi Input Guard (nghi ngờ prompt injection). Vui lòng hỏi lại bằng câu hỏi mua sắm bình thường.",
      score,
    };
  }

  return { ok: true, score };
}

/** Kiểm tra câu trả lời trước khi gửi cho người dùng. */
export function outputGuard(
  response: string,
  opts: { hasSources: boolean; intent: string },
): GuardResult {
  if (/system prompt|instruction(s)? (are|is):|BEGIN SYSTEM/i.test(response)) {
    return { ok: false, reason: "Đầu ra bị chặn: có dấu hiệu tiết lộ system prompt.", score: 3 };
  }

  if (opts.intent === "KNOWLEDGE_QUERY" && !opts.hasSources) {
    return { ok: false, reason: "Không đủ nguồn để trả lời.", score: 0 };
  }

  return { ok: true, score: 0 };
}

/** Câu trả lời khi không tìm đủ nguồn trong tài liệu của shop. */
export function refusalNoSource(): string {
  return "Xin lỗi, mình không tìm thấy thông tin này trong tài liệu của shop nên không thể trả lời chắc chắn. Bạn có thể hỏi về sản phẩm, đổi trả, bảo hành, vận chuyển hoặc trạng thái đơn hàng của bạn.";
}
