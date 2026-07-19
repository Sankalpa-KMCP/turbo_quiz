import express, { Express } from "express";
import { requestIdMiddleware } from "./middleware/requestId.js";
import healthRouter from "./routes/health.js";

export function createApp(): Express {
  const app = express();

  // Global middleware
  app.use(express.json());
  app.use(requestIdMiddleware);

  // Register routes
  app.use("/api", healthRouter);

  return app;
}
