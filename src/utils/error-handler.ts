
export class ErrorHandler {
  private logger?: any;

  public constructor(logger?: any) {
    this.logger = logger;
  }

  static handle(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  static getStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }

  async withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 100): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (this.logger?.warn) {
          this.logger.warn(`Retry ${attempt} failed: ${ErrorHandler.handle(err)}`);
        }
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }
}
