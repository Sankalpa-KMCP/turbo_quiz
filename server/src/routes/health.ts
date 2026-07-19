import { Router, Response } from "express";
import { RequestWithId } from "../middleware/requestId.js";

const router = Router();

router.get("/health", (req: RequestWithId, res: Response) => {
  res.status(200).json({
    status: "healthy",
    requestId: req.id || ""
  });
});

export default router;
