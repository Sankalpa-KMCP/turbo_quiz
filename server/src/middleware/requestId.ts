import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface RequestWithId extends Request {
  id?: string;
}

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const reqId = crypto.randomUUID();
  req.id = reqId;
  res.setHeader("X-Request-ID", reqId);
  next();
}
