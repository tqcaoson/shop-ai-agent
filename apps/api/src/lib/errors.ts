// Lỗi HTTP dùng chung cho các module của API.
//
// Service chỉ cần ném HttpError với mã trạng thái và thông báo tiếng Việt,
// route sẽ bắt và trả về đúng mã đó. Lỗi không phải HttpError được coi là
// lỗi hệ thống và trả về 500, không lộ chi tiết nội bộ ra ngoài.
import type { Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Trả về một lỗi JSON theo đúng định dạng chung của API: { error: "..." }. */
export function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

/**
 * Xử lý lỗi trong các route handler.
 * HttpError thì giữ nguyên mã và thông báo, lỗi khác thì trả về 500 chung.
 */
export function handleRouteError(res: Response, error: unknown) {
  if (error instanceof HttpError) {
    return sendError(res, error.status, error.message);
  }

  console.error(error);

  return sendError(res, 500, "Đã xảy ra lỗi khi xử lý yêu cầu, vui lòng thử lại sau.");
}
