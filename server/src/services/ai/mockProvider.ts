import { z } from "zod";
import { AiProvider, AiGenerationInput } from "./provider.js";
import { AiError, AiMalformedOutputError, AiAbortError } from "./errors.js";

export type MockScenarioType =
  | { type: "success"; value: unknown }
  | { type: "malformed"; rawOutput: string }
  | { type: "failure"; message: string }
  | { type: "empty" }
  | { type: "delay"; delayMs: number; scenario: MockScenarioType };

export class MockAiProvider implements AiProvider {
  private scenarios: MockScenarioType[] = [];
  private currentScenarioIndex = 0;

  constructor(options?: { scenarios?: MockScenarioType[] }) {
    if (options?.scenarios) {
      this.scenarios = [...options.scenarios];
    }
  }

  public addScenario(scenario: MockScenarioType): void {
    this.scenarios.push(scenario);
  }

  public async generateStructured<T>(input: AiGenerationInput<T>): Promise<T> {
    const { responseSchema, signal } = input;

    // Check pre-aborted signal
    if (signal?.aborted) {
      throw new AiAbortError();
    }

    // Retrieve active scenario
    const scenario = this.scenarios[this.currentScenarioIndex];
    if (!scenario) {
      throw new AiError("No mock scenario configured for this request.");
    }

    // Increment index if we have multiple, otherwise stay on last one
    if (this.currentScenarioIndex < this.scenarios.length - 1) {
      this.currentScenarioIndex++;
    }

    return this.executeScenario(scenario, responseSchema, signal);
  }

  private async executeScenario<T>(
    scenario: MockScenarioType,
    responseSchema: z.ZodType<T>,
    signal?: AbortSignal
  ): Promise<T> {
    if (scenario.type === "delay") {
      const { delayMs, scenario: nextScenario } = scenario;

      await new Promise<void>((resolve, reject) => {
        const state = { timeoutId: undefined as NodeJS.Timeout | undefined };

        const onAbort = () => {
          if (state.timeoutId) {
            clearTimeout(state.timeoutId);
          }
          if (signal) {
            signal.removeEventListener("abort", onAbort);
          }
          reject(new AiAbortError());
        };

        if (signal?.aborted) {
          return reject(new AiAbortError());
        }

        if (signal) {
          signal.addEventListener("abort", onAbort);
        }

        state.timeoutId = setTimeout(() => {
          if (signal) {
            signal.removeEventListener("abort", onAbort);
          }
          resolve();
        }, delayMs);
      });

      return this.executeScenario(nextScenario, responseSchema, signal);
    }

    if (scenario.type === "failure") {
      throw new AiError(scenario.message);
    }

    if (scenario.type === "empty") {
      const parsed = responseSchema.safeParse({});
      if (!parsed.success) {
        throw new AiMalformedOutputError("AI returned empty/invalid result", parsed.error);
      }
      return parsed.data;
    }

    if (scenario.type === "malformed") {
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(scenario.rawOutput);
      } catch (err) {
        throw new AiMalformedOutputError(
          `Failed to parse AI output as JSON: ${err instanceof Error ? err.message : String(err)}`,
          err
        );
      }

      const parsed = responseSchema.safeParse(parsedValue);
      if (!parsed.success) {
        throw new AiMalformedOutputError(
          "AI output does not conform to the schema",
          parsed.error
        );
      }
      return parsed.data;
    }

    if (scenario.type === "success") {
      const parsed = responseSchema.safeParse(scenario.value);
      if (!parsed.success) {
        throw new AiMalformedOutputError(
          "Mock success value does not conform to the schema",
          parsed.error
        );
      }
      return parsed.data;
    }

    throw new Error("Unsupported mock scenario type");
  }
}
