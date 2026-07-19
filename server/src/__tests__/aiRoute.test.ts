import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { MockAiProvider } from "../services/ai/mockProvider.js";
import {
  aiQuestionResponseSchema,
  aiApiErrorSchema
} from "@turboquiz/shared";

const validRequest = {
  sourceText: "a".repeat(250),
  questionCount: 2,
  difficulty: "medium",
  subjectName: "Science",
  topicName: "Space Exploration",
  includeExplanations: true,
  includeSourceExcerpts: true
};

const validMockQuestions = {
  questions: [
    {
      questionText: "What is the capital of planet Mars?",
      options: ["Olympus Mons", "Valles Marineris", "Cydonia", "No capital"],
      correctOptionIndex: 3,
      difficulty: "medium",
      explanation: "Mars does not have a capital city.",
      sourceExcerpt: "Mars is uninhabited and has no cities."
    }
  ]
};

describe("POST /api/ai/questions - Integration Tests", () => {
  it("returns 200 and valid response structure on success", async () => {
    const mockProvider = new MockAiProvider({
      scenarios: [{ type: "success", value: validMockQuestions }]
    });
    const app = createApp(mockProvider);

    const response = await request(app)
      .post("/api/ai/questions")
      .send(validRequest)
      .expect(200);

    // Validate using shared schema
    const parsed = aiQuestionResponseSchema.parse(response.body);
    expect(parsed.generationId).toBeDefined();
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].questionText).toBe("What is the capital of planet Mars?");
  });

  it("returns 400 validation error for invalid payloads", async () => {
    const mockProvider = new MockAiProvider();
    const app = createApp(mockProvider);

    const invalidRequest = { ...validRequest, sourceText: "too short" };

    const response = await request(app)
      .post("/api/ai/questions")
      .send(invalidRequest)
      .expect(400);

    const error = aiApiErrorSchema.parse(response.body);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.retryable).toBe(false);
  });

  it("returns 502 Bad Gateway when AI returns malformed output", async () => {
    const mockProvider = new MockAiProvider({
      scenarios: [{ type: "malformed", rawOutput: "{invalid-json" }]
    });
    const app = createApp(mockProvider);

    const response = await request(app)
      .post("/api/ai/questions")
      .send(validRequest)
      .expect(502);

    const error = aiApiErrorSchema.parse(response.body);
    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toContain("malformed");
    expect(error.retryable).toBe(true);
  });

  it("returns 502 Bad Gateway when AI provider encounters internal API issues", async () => {
    const mockProvider = new MockAiProvider({
      scenarios: [{ type: "failure", message: "Upstream API timeout" }]
    });
    const app = createApp(mockProvider);

    const response = await request(app)
      .post("/api/ai/questions")
      .send(validRequest)
      .expect(502);

    const error = aiApiErrorSchema.parse(response.body);
    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toContain("Upstream API timeout");
    expect(error.retryable).toBe(true);
  });

  it("enforces rate limiting and returns 429 when limit is exceeded", async () => {
    const mockProvider = new MockAiProvider({
      scenarios: [
        { type: "success", value: validMockQuestions },
        { type: "success", value: validMockQuestions },
        { type: "success", value: validMockQuestions }
      ]
    });
    // Set limit of 2 requests per minute for testing
    const app = createApp(mockProvider, 2);

    // First request
    await request(app)
      .post("/api/ai/questions")
      .send(validRequest)
      .expect(200);

    // Second request
    await request(app)
      .post("/api/ai/questions")
      .send(validRequest)
      .expect(200);

    // Third request (should be rate limited)
    const response = await request(app)
      .post("/api/ai/questions")
      .send(validRequest)
      .expect(429);

    const error = aiApiErrorSchema.parse(response.body);
    expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(error.retryable).toBe(true);
  });

  it("propagates client disconnection/abort and handles it gracefully", async () => {
    const mockProvider = new MockAiProvider({
      scenarios: [
        {
          type: "delay",
          delayMs: 300,
          scenario: { type: "success", value: validMockQuestions }
        }
      ]
    });
    const app = createApp(mockProvider);

    const req = request(app)
      .post("/api/ai/questions")
      .send(validRequest);

    // Abort the request after a short delay
    setTimeout(() => {
      req.abort();
    }, 50);

    // The promise will reject due to connection abort/destruction
    await expect(req).rejects.toThrow();
  });
});
