import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Logger } from './logger.js';

interface RateLimit {
  rpm: number;  // requests per minute
  tpm: number;  // tokens per minute
}

export class RateLimiter {
  private limiters: Map<string, RateLimiterMemory> = new Map();
  private logger: Logger;

  constructor(private rateLimits: Record<string, RateLimit>) {
    this.logger = new Logger();
    this.initializeLimiters();
  }

  private initializeLimiters(): void {
    Object.entries(this.rateLimits).forEach(([key, limit]) => {
      // Request rate limiter
      this.limiters.set(`${key}_requests`, new RateLimiterMemory({
        keyPrefix: `groq_${key}_req`,
        points: limit.rpm,
        duration: 60,
        blockDuration: 60
      }));

      // Token rate limiter
      this.limiters.set(`${key}_tokens`, new RateLimiterMemory({
        keyPrefix: `groq_${key}_tok`,
        points: limit.tpm,
        duration: 60,
        blockDuration: 60
      }));
    });

    this.logger.info(`Initialized rate limiters for ${Object.keys(this.rateLimits).length} endpoints`);
  }

  async checkLimit(key: string, tokens: number = 1): Promise<void> {
    const requestLimiter = this.limiters.get(`${key}_requests`);
    const tokenLimiter = this.limiters.get(`${key}_tokens`);

    if (!requestLimiter || !tokenLimiter) {
      this.logger.warn(`No rate limiter found for key: ${key}`);
      return;
    }

    try {
      // Check request limit
      await requestLimiter.consume(key, 1);
      
      // Check token limit
      await tokenLimiter.consume(key, tokens);
      
    } catch (rateLimiterRes) {
      const secs = Math.round((rateLimiterRes as any).msBeforeNext / 1000) || 1;
      this.logger.warn(`Rate limit exceeded for ${key}, retry in ${secs}s`);
      throw new Error(`Rate limit exceeded. Retry in ${secs} seconds.`);
    }
  }

  async getRemainingPoints(key: string): Promise<{ requests: number; tokens: number }> {
    const requestLimiter = this.limiters.get(`${key}_requests`);
    const tokenLimiter = this.limiters.get(`${key}_tokens`);

    if (!requestLimiter || !tokenLimiter) {
      return { requests: 0, tokens: 0 };
    }

    const [requestRes, tokenRes] = await Promise.all([
      requestLimiter.get(key),
      tokenLimiter.get(key)
    ]);

    return {
      requests: requestRes?.remainingPoints || 0,
      tokens: tokenRes?.remainingPoints || 0
    };
  }
}
