import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { validateAndLoadConfig } from "../config.js";

describe("Express Server Shell", () => {
  it("GET /api/health returns 200 and healthy status", async () => {
    const app = createApp();
    const response = await request(app)
      .get("/api/health")
      .expect(200);

    expect(response.body).toHaveProperty("status", "healthy");
    expect(response.body).toHaveProperty("requestId");
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
  });

  it("generates unique requestId for each request", async () => {
    const app = createApp();
    const res1 = await request(app).get("/api/health");
    const res2 = await request(app).get("/api/health");

    expect(res1.body.requestId).not.toBe(res2.body.requestId);
  });

  it("validates config PORT correctly", () => {
    const originalPort = process.env.PORT;

    try {
      process.env.PORT = "invalid-port";
      expect(() => validateAndLoadConfig()).toThrow();

      process.env.PORT = "-1";
      expect(() => validateAndLoadConfig()).toThrow();

      process.env.PORT = "65536";
      expect(() => validateAndLoadConfig()).toThrow();

      process.env.PORT = "8080";
      const config = validateAndLoadConfig();
      expect(config.PORT).toBe(8080);
    } finally {
      process.env.PORT = originalPort;
    }
  });
});
