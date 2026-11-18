// Cache: giao diện giống Redis, mặc định chạy bằng bộ nhớ trong (in-memory).
// Nếu REDIS_URL được cấu hình VÀ gói ioredis đã cài thì dùng Redis thật,
// nếu không thì tự động dùng bộ nhớ trong (không làm hỏng app).
// TTL theo thiết kế: câu trả lời chính xác 1–24 giờ, embedding 24 giờ,
// truy vấn RAG 5–30 phút, chi tiết sản phẩm 1–5 phút,
// tồn kho/đơn hàng 5–15 giây, trạng thái vận chuyển 30–60 giây.
type Entry = { value: string; expiresAt: number };
export class Cache {
  private mem = new Map<string, Entry>();
  private redis: {
    get(k: string): Promise<string | null>;
    set(k: string, v: string, mode: string, ttl: number): Promise<unknown>;
    del(...k: string[]): Promise<unknown>;
  } | null = null;
  private redisReady = false;
  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      // ioredis là dependency tuỳ chọn: chỉ cần khi REDIS_URL được cấu hình.
      // @ts-ignore — bỏ qua lỗi thiếu kiểu khai báo khi gói chưa được cài.
      import("ioredis")
        .then((m: { default: new (u: string) => typeof this.redis }) => {
          this.redis = new m.default(url) as typeof this.redis;
          this.redisReady = true;
        })
        .catch(() => {
          this.redis = null;
        });
    }
  }
  private memGet(key: string): string | null {
    const e = this.mem.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.mem.delete(key);
      return null;
    }
    return e.value;
  }
  async get(key: string): Promise<string | null> {
    if (this.redisReady && this.redis) {
      try {
        return await this.redis.get(key);
      } catch {
        /* Lỗi Redis thì dùng bộ nhớ trong */
      }
    }
    return this.memGet(key);
  }
  async set(key: string, value: string, ttlSec: number): Promise<void> {
    if (this.redisReady && this.redis) {
      try {
        await this.redis.set(key, value, "EX", ttlSec);
      } catch {
        /* Lỗi Redis thì dùng bộ nhớ trong */
      }
    }
    this.mem.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }
  async del(...keys: string[]): Promise<void> {
    for (const k of keys) this.mem.delete(k);
    if (this.redisReady && this.redis) {
      try {
        await this.redis.del(...keys);
      } catch {
        /* Bỏ qua lỗi Redis */
      }
    }
  }
  // QUAN TRỌNG: khóa cache phải gồm tenant + phạm vi quyền + phiên bản knowledge.
  // Không bao giờ cache câu trả lời chứa dữ liệu cá nhân vào khóa dùng chung.
  exactKey(tenant: string, scope: string, version: number, query: string) {
    return `exact:${tenant}:${scope}:v${version}:${query.trim().toLowerCase()}`;
  }
  embeddingKey(query: string) {
    return `emb:${query.trim().toLowerCase()}`;
  }
  ragKey(tenant: string, version: number, query: string) {
    return `rag:${tenant}:v${version}:${query.trim().toLowerCase()}`;
  }
  toolKey(tool: string, args: string) {
    return `tool:${tool}:${args}`;
  }
  productKey(id: string) {
    return `product:${id}`;
  }
  inventoryKey(variantId: string) {
    return `inv:${variantId}`;
  }
  orderKey(orderId: string, userId: string) {
    return `order:${userId}:${orderId}`;
  }
}
export const cache = new Cache();
