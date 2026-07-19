import { z } from "zod";

export interface AiGenerationSettings {
  temperature?: number;
  maxTokens?: number;
}

export interface AiGenerationInput<T> {
  systemInstruction?: string;
  userPrompt: string;
  responseSchema: z.ZodType<T>;
  signal?: AbortSignal;
  settings?: AiGenerationSettings;
}

export interface AiProvider {
  generateStructured<T>(input: AiGenerationInput<T>): Promise<T>;
}
