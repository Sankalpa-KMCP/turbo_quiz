import { ServerConfig } from "../../config.js";
import { AiProvider } from "./provider.js";
import { MockAiProvider } from "./mockProvider.js";

export function createAiProvider(config: ServerConfig): AiProvider {
  if (config.AI_PROVIDER !== "mock") {
    throw new Error(`Unsupported AI provider: "${config.AI_PROVIDER}"`);
  }
  return new MockAiProvider({
    defaultScenario: {
      type: "success",
      value: {
        questions: [
          {
            questionText: "What is the powerhouse of the cell?",
            options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"],
            correctOptionIndex: 1,
            difficulty: "easy",
            explanation: "Mitochondria generates chemical energy.",
            sourceExcerpt: "Mitochondria are double-membraned organelles responsible for generating ATP."
          }
        ]
      }
    }
  });
}
