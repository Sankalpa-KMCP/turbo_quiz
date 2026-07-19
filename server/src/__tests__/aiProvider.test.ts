import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validateAndLoadConfig } from "../config.js";
import { createAiProvider } from "../services/ai/factory.js";
import { MockAiProvider } from "../services/ai/mockProvider.js";
import { AiError, AiMalformedOutputError, AiAbortError } from "../services/ai/errors.js";

const testSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

describe("AI Configuration & Provider System", () => {
  describe("Configuration Validation", () => {
    it("defaults AI_PROVIDER to mock and does not require keys", () => {
      const originalEnv = { ...process.env };
      try {
        delete process.env.AI_PROVIDER;
        delete process.env.AI_API_KEY;
        delete process.env.AI_MODEL;

        const config = validateAndLoadConfig();
        expect(config.AI_PROVIDER).toBe("mock");
        expect(config.AI_API_KEY).toBeUndefined();
        expect(config.AI_MODEL).toBeUndefined();
      } finally {
        process.env = originalEnv;
      }
    });

    it("throws an error when AI_PROVIDER is not mock", () => {
      const originalEnv = { ...process.env };
      try {
        process.env.AI_PROVIDER = "unsupported-provider";
        expect(() => validateAndLoadConfig()).toThrow(/AI_PROVIDER "unsupported-provider" is unsupported/);
      } finally {
        process.env = originalEnv;
      }
    });

    it("throws an error when AI_PROVIDER is missing in production mode", () => {
      const originalEnv = { ...process.env };
      try {
        process.env.NODE_ENV = "production";
        delete process.env.AI_PROVIDER;
        expect(() => validateAndLoadConfig()).toThrow(/AI_PROVIDER is required in production environment/);
      } finally {
        process.env = originalEnv;
      }
    });

    it("validates valid and invalid PORT configurations", () => {
      const originalEnv = { ...process.env };
      try {
        process.env.PORT = "abc";
        expect(() => validateAndLoadConfig()).toThrow(/PORT "abc" must be a valid integer/);

        process.env.PORT = "99999";
        expect(() => validateAndLoadConfig()).toThrow(/PORT "99999" must be a valid integer/);

        process.env.PORT = "3002";
        const config = validateAndLoadConfig();
        expect(config.PORT).toBe(3002);
      } finally {
        process.env = originalEnv;
      }
    });

    it("validates valid and invalid AI_REQUESTS_PER_MINUTE configurations", () => {
      const originalEnv = { ...process.env };
      try {
        process.env.AI_REQUESTS_PER_MINUTE = "abc";
        expect(() => validateAndLoadConfig()).toThrow(/AI_REQUESTS_PER_MINUTE must be a valid integer greater than zero/);

        process.env.AI_REQUESTS_PER_MINUTE = "0";
        expect(() => validateAndLoadConfig()).toThrow(/AI_REQUESTS_PER_MINUTE must be a valid integer greater than zero/);

        process.env.AI_REQUESTS_PER_MINUTE = "-5";
        expect(() => validateAndLoadConfig()).toThrow(/AI_REQUESTS_PER_MINUTE must be a valid integer greater than zero/);

        process.env.AI_REQUESTS_PER_MINUTE = "15";
        const config = validateAndLoadConfig();
        expect(config.AI_REQUESTS_PER_MINUTE).toBe(15);
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe("Provider Factory", () => {
    it("successfully creates a MockAiProvider for mock config", () => {
      const config = {
        PORT: 3001,
        NODE_ENV: "test",
        AI_PROVIDER: "mock",
        AI_REQUESTS_PER_MINUTE: 10,
      };
      const provider = createAiProvider(config);
      expect(provider).toBeInstanceOf(MockAiProvider);
    });

    it("throws when config has an unsupported provider", () => {
      const config = {
        PORT: 3001,
        NODE_ENV: "test",
        AI_PROVIDER: "invalid",
        AI_REQUESTS_PER_MINUTE: 10,
      };
      expect(() => createAiProvider(config)).toThrow(/Unsupported AI provider: "invalid"/);
    });
  });

  describe("MockAiProvider Scenarios", () => {
    it("returns valid structured data for a success scenario", async () => {
      const value = { success: true, message: "Hello from Mock AI!" };
      const provider = new MockAiProvider({
        scenarios: [{ type: "success", value }],
      });

      const result = await provider.generateStructured({
        userPrompt: "Give me greeting",
        responseSchema: testSchema,
      });

      expect(result).toEqual(value);
    });

    it("throws AiMalformedOutputError if success value does not match schema", async () => {
      const value = { success: "not-a-boolean", message: "Invalid type" };
      const provider = new MockAiProvider({
        scenarios: [{ type: "success", value }],
      });

      await expect(
        provider.generateStructured({
          userPrompt: "Requesting malformed success",
          responseSchema: testSchema,
        })
      ).rejects.toThrow(AiMalformedOutputError);
    });

    it("throws AiMalformedOutputError for invalid JSON output in malformed scenario", async () => {
      const provider = new MockAiProvider({
        scenarios: [{ type: "malformed", rawOutput: "{invalid-json" }],
      });

      await expect(
        provider.generateStructured({
          userPrompt: "Requesting invalid JSON",
          responseSchema: testSchema,
        })
      ).rejects.toThrow(AiMalformedOutputError);
    });

    it("throws AiMalformedOutputError for valid JSON failing schema validation in malformed scenario", async () => {
      const provider = new MockAiProvider({
        scenarios: [{ type: "malformed", rawOutput: '{"success": false}' }],
      });

      await expect(
        provider.generateStructured({
          userPrompt: "Requesting validation fail JSON",
          responseSchema: testSchema,
        })
      ).rejects.toThrow(AiMalformedOutputError);
    });

    it("throws AiError for failure scenario", async () => {
      const provider = new MockAiProvider({
        scenarios: [{ type: "failure", message: "AI API error occurred" }],
      });

      await expect(
        provider.generateStructured({
          userPrompt: "Failing request",
          responseSchema: testSchema,
        })
      ).rejects.toThrow(AiError);
    });

    it("throws AiMalformedOutputError for empty scenario failing schema", async () => {
      const provider = new MockAiProvider({
        scenarios: [{ type: "empty" }],
      });

      await expect(
        provider.generateStructured({
          userPrompt: "Empty request",
          responseSchema: testSchema,
        })
      ).rejects.toThrow(AiMalformedOutputError);
    });

    it("passes empty scenario if the Zod schema allows empty/optional values", async () => {
      const optionalSchema = z.object({
        success: z.boolean().optional(),
      });
      const provider = new MockAiProvider({
        scenarios: [{ type: "empty" }],
      });

      const result = await provider.generateStructured({
        userPrompt: "Empty optional request",
        responseSchema: optionalSchema,
      });

      expect(result).toEqual({});
    });

    it("resolves after a delay scenario", async () => {
      const successVal = { success: true, message: "Delayed hello!" };
      const provider = new MockAiProvider({
        scenarios: [
          {
            type: "delay",
            delayMs: 50,
            scenario: { type: "success", value: successVal },
          },
        ],
      });

      const startTime = Date.now();
      const result = await provider.generateStructured({
        userPrompt: "Delayed request",
        responseSchema: testSchema,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(40);
      expect(result).toEqual(successVal);
    });

    it("rejects immediately if signal is already aborted", async () => {
      const provider = new MockAiProvider({
        scenarios: [{ type: "success", value: { success: true, message: "Will not run" } }],
      });

      const controller = new AbortController();
      controller.abort();

      await expect(
        provider.generateStructured({
          userPrompt: "Aborted request",
          responseSchema: testSchema,
          signal: controller.signal,
        })
      ).rejects.toThrow(AiAbortError);
    });

    it("aborts correctly during a delay scenario", async () => {
      const provider = new MockAiProvider({
        scenarios: [
          {
            type: "delay",
            delayMs: 200,
            scenario: { type: "success", value: { success: true, message: "Will not reach" } },
          },
        ],
      });

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);

      const promise = provider.generateStructured({
        userPrompt: "Abort mid-delay request",
        responseSchema: testSchema,
        signal: controller.signal,
      });

      await expect(promise).rejects.toThrow(AiAbortError);
    });

    it("adds and removes abort event listener during delay scenario on success", async () => {
      const provider = new MockAiProvider({
        scenarios: [
          {
            type: "delay",
            delayMs: 10,
            scenario: { type: "success", value: { success: true, message: "OK" } },
          },
        ],
      });

      const controller = new AbortController();
      const signal = controller.signal;
      const addSpy = vi.spyOn(signal, "addEventListener");
      const removeSpy = vi.spyOn(signal, "removeEventListener");

      const result = await provider.generateStructured({
        userPrompt: "spy check success",
        responseSchema: testSchema,
        signal,
      });

      expect(result).toEqual({ success: true, message: "OK" });
      expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    });

    it("adds and removes abort event listener when aborted during delay scenario", async () => {
      const provider = new MockAiProvider({
        scenarios: [
          {
            type: "delay",
            delayMs: 200,
            scenario: { type: "success", value: { success: true, message: "OK" } },
          },
        ],
      });

      const controller = new AbortController();
      const signal = controller.signal;
      const addSpy = vi.spyOn(signal, "addEventListener");
      const removeSpy = vi.spyOn(signal, "removeEventListener");

      setTimeout(() => controller.abort(), 20);

      await expect(
        provider.generateStructured({
          userPrompt: "spy check abort",
          responseSchema: testSchema,
          signal,
        })
      ).rejects.toThrow(AiAbortError);

      expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    });
  });
});
