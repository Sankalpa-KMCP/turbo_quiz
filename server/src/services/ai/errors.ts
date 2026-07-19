export class AiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AiMalformedOutputError extends AiError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "AiMalformedOutputError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AiAbortError extends AiError {
  constructor(message: string = "AI generation was aborted") {
    super(message);
    this.name = "AiAbortError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
