import { createApp } from "./app.js";
import { validateAndLoadConfig } from "./config.js";
import { createAiProvider } from "./services/ai/factory.js";

try {
  const config = validateAndLoadConfig();
  const aiProvider = createAiProvider(config);
  const app = createApp(aiProvider, config.AI_REQUESTS_PER_MINUTE);

  app.listen(config.PORT, () => {
    console.log(`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}
