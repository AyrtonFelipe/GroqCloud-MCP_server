import { z } from 'zod';

// Base MCP Tool interface
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  execute(args: any): Promise<any>;
}

// Tool execution result
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    model?: string;
    tokens?: {
      input: number;
      output: number;
    };
    cached?: boolean;
    timestamp: string;
  };
}

// Server configuration
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  capabilities: {
    tools: boolean;
    logging: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  tools: MCPToolConfig[];
  rateLimits: Record<string, RateLimit>;
  models: Record<string, ModelConfig>;
}

export interface MCPToolConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstLimit?: number;
}

export interface ModelConfig {
  id: string;
  provider: 'groq';
  capabilities: string[];
  contextLength: number;
  maxTokens: number;
  defaultParams: {
    temperature: number;
    topP: number;
    maxTokens: number;
  };
  costEstimate: {
    inputPer1k: number;
    outputPer1k: number;
  };
}

// Cache configuration
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of cached items
  strategy: 'lru' | 'fifo' | 'lfu';
}

// Logging configuration
export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDir: string;
  maxFileSize: string;
  maxFiles: number;
  enableStructuredLogging: boolean;
}

// Analytics and metrics
export interface AnalyticsEvent {
  type: 'tool_execution' | 'api_call' | 'error' | 'rate_limit' | 'cache_event';
  timestamp: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per minute
  };
  tokens: {
    input: number;
    output: number;
    total: number;
    rate: number; // tokens per minute
  };
  models: Record<string, {
    requests: number;
    tokens: number;
    avgResponseTime: number;
  }>;
  tools: Record<string, {
    executions: number;
    avgDuration: number;
    successRate: number;
  }>;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  errors: Record<string, number>;
}

// Error types
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class GroqAPIError extends MCPError {
  constructor(
    message: string,
    public groqErrorCode?: string,
    statusCode?: number,
    retryable: boolean = false
  ) {
    super(message, 'GROQ_API_ERROR', statusCode, retryable);
    this.name = 'GroqAPIError';
  }
}

export class RateLimitError extends MCPError {
  constructor(
    message: string,
    public resetTime: number,
    public remaining: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true, { resetTime, remaining });
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, public validationErrors: any[]) {
    super(message, 'VALIDATION_ERROR', 400, false, { validationErrors });
    this.name = 'ValidationError';
  }
}

// Tool-specific types
export interface TextCompletionArgs {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  jsonMode?: boolean;
  systemPrompt?: string;
  priority?: 'speed' | 'quality' | 'cost';
}

export interface AudioTranscriptionArgs {
  audioFile: string;
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo';
  language?: string;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  translate?: boolean;
}

export interface VisionAnalysisArgs {
  imageUrl: string;
  prompt?: string;
  analysisType?: 'describe' | 'ocr' | 'technical' | 'creative';
  detailLevel?: 'low' | 'high';
  model?: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface BatchProcessingArgs {
  requests: Array<{
    customId?: string;
    method: 'POST';
    url: '/v1/chat/completions';
    body: any;
  }>;
  completionWindow?: '24h' | '7d';
  metadata?: Record<string, string>;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    groqApi: HealthCheck;
    rateLimit: HealthCheck;
    cache: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
  };
  metrics: MetricsSnapshot;
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  details?: Record<string, any>;
  duration?: number;
}
