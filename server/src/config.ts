export interface ServerConfig {
  PORT: number;
  NODE_ENV: string;
  AI_PROVIDER: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
}

export function validateAndLoadConfig(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV || "development";
  const portStr = process.env.PORT || "3001";
  const port = parseInt(portStr, 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Config validation error: PORT "${portStr}" must be a valid integer between 1 and 65535.`);
  }

  const aiProvider = process.env.AI_PROVIDER || (nodeEnv === "production" ? "" : "mock");
  const aiApiKey = process.env.AI_API_KEY;
  const aiModel = process.env.AI_MODEL;

  if (!aiProvider) {
    throw new Error("Config validation error: AI_PROVIDER is required in production environment.");
  }

  if (aiProvider !== "mock") {
    throw new Error(`Config validation error: AI_PROVIDER "${aiProvider}" is unsupported. Only "mock" is supported.`);
  }

  return {
    PORT: port,
    NODE_ENV: nodeEnv,
    AI_PROVIDER: aiProvider,
    AI_API_KEY: aiApiKey,
    AI_MODEL: aiModel,
  };
}
