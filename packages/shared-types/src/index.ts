// Kiểu dữ liệu dùng chung cho API, MCP Server và Agent.
export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export type Intent =
  | "KNOWLEDGE_QUERY"
  | "PRODUCT_QUERY"
  | "ORDER_QUERY"
  | "CART_ACTION"
  | "PURCHASE_ACTION"
  | "UNKNOWN";

/** Trạng thái của một lượt chạy agent, đi qua từng node của workflow. */
export interface AgentState {
  conversationId: string;
  userId: string;
  shopId: string;
  intent: string;
  userMessage: string;
  retrievedDocuments: unknown[];
  toolCalls: unknown[];
  toolResults: unknown[];
  requiresApproval: boolean;
  response: string;
}

// Tool -> quyền tương ứng, dùng ở cả API và MCP Server.
// Backend là nơi quyết định cuối cùng, MCP chỉ chuyển tiếp yêu cầu.
export const TOOL_PERMISSIONS: Record<string, string> = {
  search_products: "product.read",
  get_product: "product.read",
  check_inventory: "product.read",
  get_order: "order.read",
  list_my_orders: "order.read",
  get_shipping_status: "order.read",
  create_order: "order.create",
  cancel_order: "order.cancel",
  update_shipping_address: "order.manage",
};

/** Thông tin người dùng đã xác thực, gắn vào request sau middleware auth(). */
export interface ApiUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}
