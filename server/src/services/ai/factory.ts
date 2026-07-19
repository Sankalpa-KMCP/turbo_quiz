import { ServerConfig } from "../../config.js";
import { AiProvider } from "./provider.js";
import { MockAiProvider } from "./mockProvider.js";

export function createAiProvider(config: ServerConfig): AiProvider {
  if (config.AI_PROVIDER !== "mock") {
    throw new Error(`Unsupported AI provider: "${config.AI_PROVIDER}"`);
  }
  return new MockAiProvider();
}
