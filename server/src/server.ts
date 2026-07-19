import { createApp } from "./app.js";
import { validateAndLoadConfig } from "./config.js";

try {
  const config = validateAndLoadConfig();
  const app = createApp();

  app.listen(config.PORT, () => {
    console.log(`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}
