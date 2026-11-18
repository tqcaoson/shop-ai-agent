// Tạo Express app và gắn các router theo từng module.
//
// File này chỉ lo "đi dây": middleware chung và đường dẫn của từng module.
// Logic nghiệp vụ nằm trong từng module ở apps/api/src/modules/.
import cors from "cors";
import express from "express";

import { agentRouter } from "./modules/agent/agent.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { healthRouter } from "./modules/health/health.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { productsRouter } from "./modules/products/products.routes";
import { ragRouter } from "./modules/rag/rag.routes";
import { usersRouter } from "./modules/users/users.routes";

/** Tạo và cấu hình Express app, dùng chung cho cả chạy dev và chạy thật. */
export function createApp(): express.Express {
  const app = express();

  app.use(cors());

  // Giới hạn kích thước body để tránh request quá lớn làm nặng server.
  app.use(express.json({ limit: "200kb" }));

  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/products", productsRouter);
  app.use("/cart", cartRouter);
  app.use("/orders", ordersRouter);
  app.use("/agent", agentRouter);
  app.use("/rag", ragRouter);
  app.use(healthRouter);

  return app;
}
