import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { RequestWithId } from "../middleware/requestId.js";
import {
  aiQuestionRequestSchema,
  aiQuestionResponseSchema,
  aiApiErrorSchema,
} from "@turboquiz/shared";
import { AiProvider } from "../services/ai/provider.js";
import { AiError, AiMalformedOutputError, AiAbortError } from "../services/ai/errors.js";

const router = Router();

// Helper to format and validate errors against the shared aiApiErrorSchema
function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
  retryable: boolean
): void {
  const errorPayload = {
    code,
    message,
    requestId,
    retryable,
  };

  const parsed = aiApiErrorSchema.safeParse(errorPayload);
  if (parsed.success) {
    res.status(status).json(parsed.data);
  } else {
    // Fallback safe error if validation somehow fails
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "An internal server error occurred",
      requestId,
      retryable: false,
    });
  }
}

// Build custom rate-limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: RequestWithId) => {
    return req.app.get("aiRequestsPerMinute") || 10;
  },
  keyGenerator: (req: RequestWithId) => {
    const ip = (req.ip || req.headers["x-forwarded-for"] || "fallback-ip-key") as string;
    const appId = req.app.get("appId") || "default-app-id";
    return `${appId}-${ip}`;
  },
  handler: (req: RequestWithId, res: Response) => {
    sendError(
      res,
      429,
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please try again later.",
      req.id || crypto.randomUUID(),
      true
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/ai/questions",
  limiter,
  async (req: RequestWithId, res: Response): Promise<void> => {
    const requestId = req.id || crypto.randomUUID();

    // 1. Validate request payload using shared Zod schema
    const validationResult = aiQuestionRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      sendError(res, 400, "VALIDATION_ERROR", errorMessage, requestId, false);
      return;
    }

    const aiProvider = req.app.get("aiProvider") as AiProvider | undefined;
    if (!aiProvider) {
      sendError(
        res,
        500,
        "INTERNAL_ERROR",
        "AI service provider is not configured",
        requestId,
        false
      );
      return;
    }

    // 2. Setup AbortController to propagate client disconnections
    const controller = new AbortController();
    const onClientClose = () => {
      controller.abort();
    };

    req.on("close", onClientClose);

    try {
      // 3. Define the response schema expected from the provider
      const providerResponseSchema = aiQuestionResponseSchema.omit({ generationId: true });

      const providerOutput = await aiProvider.generateStructured({
        userPrompt: JSON.stringify(validationResult.data),
        responseSchema: providerResponseSchema,
        signal: controller.signal,
      });

      // 4. Construct complete response payload with server-generated generationId
      const generationId = crypto.randomUUID();
      const responsePayload = {
        generationId,
        questions: providerOutput.questions,
      };

      // 5. Validate complete response using the shared contract schema
      const completeValidationResult = aiQuestionResponseSchema.safeParse(responsePayload);
      if (!completeValidationResult.success) {
        sendError(
          res,
          502,
          "BAD_GATEWAY",
          "AI provider response validation failed",
          requestId,
          true
        );
        return;
      }

      res.status(200).json(completeValidationResult.data);
    } catch (error) {
      if (error instanceof AiAbortError || (error as Error).name === "AiAbortError" || controller.signal.aborted) {
        // Client abort
        if (!res.headersSent) {
          sendError(
            res,
            499,
            "REQUEST_CANCELLED",
            "AI generation request was cancelled by the client.",
            requestId,
            false
          );
        }
      } else if (error instanceof AiMalformedOutputError) {
        sendError(
          res,
          502,
          "BAD_GATEWAY",
          "AI provider returned malformed structured output.",
          requestId,
          true
        );
      } else if (error instanceof AiError) {
        sendError(
          res,
          502,
          "BAD_GATEWAY",
          `AI provider error: ${error.message}`,
          requestId,
          true
        );
      } else {
        // Unexpected error
        sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "An unexpected server error occurred during generation.",
          requestId,
          false
        );
      }
    } finally {
      req.off("close", onClientClose);
    }
  }
);

export default router;
