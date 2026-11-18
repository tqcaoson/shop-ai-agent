// Route kiểm tra sức khỏe của API.
import { Router } from "express";

import { budgetStatus } from "../../../../../packages/ai-core/src/cost";
import { appState } from "../../lib/state";

export const healthRouter = Router();

/** GET /health — trạng thái API, phiên bản knowledge và ngân sách AI. */
healthRouter.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    knowledgeVersion: appState.knowledgeVersion,
    budget: budgetStatus().action,
  });
});
