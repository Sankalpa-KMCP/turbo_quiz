import express, { Express } from "express";
import crypto from "crypto";
import { requestIdMiddleware } from "./middleware/requestId.js";
import healthRouter from "./routes/health.js";
import aiRouter from "./routes/ai.js";
import { AiProvider } from "./services/ai/provider.js";

export function createApp(aiProvider: AiProvider, aiRequestsPerMinute: number = 10): Express {
  const app = express();

  // Inject dependencies via app settings
  app.set("appId", crypto.randomUUID());
  app.set("aiProvider", aiProvider);
  app.set("aiRequestsPerMinute", aiRequestsPerMinute);

  // Global middleware with a safe explicit body size limit (150KB)
  // which fits the 50k character input limit plus JSON envelope and metadata
  app.use(express.json({ limit: "150kb" }));
  app.use(requestIdMiddleware);

  // Register routes
  app.use("/api", healthRouter);
  app.use("/api", aiRouter);

  return app;
}
