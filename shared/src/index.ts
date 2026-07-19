// Minimal entry point for shared package
export const SHARED_CONSTANT = "turboquiz-shared-v1";

export interface SharedConfig {
  version: string;
}

export function getSharedConfig(): SharedConfig {
  return {
    version: SHARED_CONSTANT
  };
}
