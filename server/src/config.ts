export interface ServerConfig {
  PORT: number;
  NODE_ENV: string;
}

export function validateAndLoadConfig(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV || "development";
  const portStr = process.env.PORT || "3001";
  const port = parseInt(portStr, 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Config validation error: PORT "${portStr}" must be a valid integer between 1 and 65535.`);
  }

  return {
    PORT: port,
    NODE_ENV: nodeEnv,
  };
}
