
// **Observações sobre as mudanças:**

// * **`RATE_LIMITS`:** Atualizado para incluir os novos modelos e remover os descontinuados. Os valores de `rpm` e `tpm` para os novos modelos são exemplos baseados em modelos semelhantes e podem precisar de ajuste fino com base na documentação exata da Groq.

import { GroqModel, ModelCapability } from '../types/groq-types.js';
import modelsConfig from './models.json' with { type: 'json' };

// Rate limits based on Groq API documentation
export const RATE_LIMITS = {
  // Text completion models
  'llama-3.1-8b-instant': { rpm: 30, tpm: 30000 },
  'llama-3.3-70b-versatile': { rpm: 30, tpm: 6000 },
  'deepseek-r1-distill-llama-70b': { rpm: 20, tpm: 6000 },
  'qwen-qwq-32b': { rpm: 30, tpm: 6000 },
  'qwen/qwen3-32b': { rpm: 30, tpm: 6000 },
  'compound-beta': { rpm: 20, tpm: 4000 },
  'compound-beta-mini': { rpm: 40, tpm: 8000 }, // Exemplo: ajustado para mini
  'allam-2-7b': { rpm: 35, tpm: 25000 }, // Exemplo
  'gemma2-9b-it': { rpm: 30, tpm: 15000 }, // Exemplo
  'llama3-70b-8192': { rpm: 30, tpm: 6000 }, // Exemplo
  'llama3-8b-8192': { rpm: 30, tpm: 30000 }, // Exemplo
  'meta-llama/llama-guard-4-12b': { rpm: 30, tpm: 10000 }, // Exemplo
  'meta-llama/llama-prompt-guard-2-22m': { rpm: 50, tpm: 20000 }, // Exemplo
  'meta-llama/llama-prompt-guard-2-86m': { rpm: 40, tpm: 15000 }, // Exemplo
  'mistral-saba-24b': { rpm: 30, tpm: 10000 }, // Exemplo

  // Audio models
  'whisper-large-v3': { rpm: 20, tpm: 0 },
  'whisper-large-v3-turbo': { rpm: 30, tpm: 0 },
  'distil-whisper-large-v3-en': { rpm: 40, tpm: 0 }, // Exemplo: novo modelo de áudio

  // Vision models
  'llama-4-scout-17b-instruct': { rpm: 30, tpm: 6000 },
  'llama-4-maverick-17b-instruct': { rpm: 30, tpm: 6000 },

  // Text-to-Speech models
  'playai-tts': { rpm: 50, tpm: 0 }, // Exemplo: novo modelo TTS
  'playai-tts-arabic': { rpm: 50, tpm: 0 }, // Exemplo: novo modelo TTS

  // Special endpoints (manter, se ainda relevantes para você)
  'batch_processing': { rpm: 100, tpm: 0 },
  'audio_whisper-large-v3': { rpm: 20, tpm: 0 },
  'audio_whisper-large-v3-turbo': { rpm: 30, tpm: 0 },
  'vision_llama-4-scout-17b-instruct': { rpm: 30, tpm: 6000 },
  'vision_llama-4-maverick-17b-instruct': { rpm: 30, tpm: 6000 }
};

// Groq models configuration
export const GROQ_MODELS: Record<string, GroqModel> = Object.entries(modelsConfig.models).reduce((acc, [key, model]) => {
  acc[key] = {
    id: key,
    name: model.name,
    description: model.description,
    capabilities: model.capabilities as ModelCapability[],
    contextLength: model.contextLength,
    maxTokens: model.maxTokens,
    costPer1kTokens: model.costPer1kTokens,
    speedRating: model.speedRating,
    qualityRating: model.qualityRating,
    rateLimits: {
      requestsPerMinute: model.rateLimits.requestsPerMinute,
      tokensPerMinute: model.rateLimits.tokensPerMinute
    }
  };
  return acc;
}, {} as Record<string, GroqModel>);

// API endpoints
export const GROQ_API_BASE = '[https://api.groq.com/openai/v1](https://api.groq.com/openai/v1)';

export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/chat/completions',
  AUDIO_TRANSCRIPTIONS: '/audio/transcriptions',
  AUDIO_TRANSLATIONS: '/audio/translations',
  BATCHES: '/batches',
  FILES: '/files',
  MODELS: '/models',
  TEXT_TO_SPEECH: '/audio/speech' // Adicionado para TTS
} as const;

// Cache settings
export const CACHE_CONFIG = {
  DEFAULT_TTL: 300, // 5 minutes
  MAX_SIZE: 1000,
  STRATEGY: 'lru' as const,
  ENABLED: process.env.NODE_ENV !== 'test'
};

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_FACTOR: 2,
  RETRYABLE_STATUS_CODES: [429, 500, 502, 503, 504],
  RETRYABLE_ERROR_CODES: [
    'rate_limit_exceeded',
    'server_error',
    'timeout',
    'connection_error'
  ]
};

// Logging configuration
export const LOG_CONFIG = {
  LEVEL: process.env.LOG_LEVEL || 'info',
  MAX_FILE_SIZE: '5m',
  MAX_FILES: 5,
  DATE_PATTERN: 'YYYY-MM-DD',
  STRUCTURED_LOGGING: true
};

// Health check configuration
export const HEALTH_CONFIG = {
  CHECK_INTERVAL: 30000, // 30 seconds
  TIMEOUT: 5000, // 5 seconds
  CRITICAL_ERROR_THRESHOLD: 0.1, // 10% error rate
  WARNING_ERROR_THRESHOLD: 0.05, // 5% error rate
  CRITICAL_RESPONSE_TIME: 5000, // 5 seconds
  WARNING_RESPONSE_TIME: 2000 // 2 seconds
};

// Metrics configuration
export const METRICS_CONFIG = {
  COLLECTION_INTERVAL: 300000, // 5 minutes
  RETENTION_DAYS: 30,
  EXPORT_ENABLED: process.env.METRICS_EXPORT === 'true',
  EXPORT_ENDPOINT: process.env.METRICS_ENDPOINT
};

// Security configuration
export const SECURITY_CONFIG = {
  MAX_REQUEST_SIZE: '10mb',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  API_KEY_HEADER: 'x-api-key',
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_CONCURRENT_REQUESTS: 100
};

// File upload configuration
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB do limite do groq
  ALLOWED_AUDIO_TYPES: [
    'audio/mpeg',
    'audio/wav',
    'audio/flac',
    'audio/m4a',
    'audio/mp3',
    'audio/mp4',
    'audio/webm'
  ],
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ],
  TEMP_DIR: process.env.TEMP_DIR || '/tmp'
};

// Model selection weights
export const MODEL_SELECTION_WEIGHTS = {
  SPEED: {
    responseTime: 0.6,
    throughput: 0.3,
    availability: 0.1
  },
  QUALITY: {
    accuracy: 0.5,
    coherence: 0.3,
    completeness: 0.2
  },
  COST: {
    tokenCost: 0.7,
    requestCost: 0.2,
    efficiency: 0.1
  }
};

// Error messages
export const ERROR_MESSAGES = {
  INVALID_API_KEY: 'Invalid or missing Groq API key',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  MODEL_NOT_FOUND: 'Specified model not found or not available',
  INVALID_REQUEST: 'Invalid request parameters',
  FILE_TOO_LARGE: 'File size exceeds maximum allowed limit',
  UNSUPPORTED_FILE_TYPE: 'Unsupported file type',
  NETWORK_ERROR: 'Network error occurred. Please try again.',
  TIMEOUT_ERROR: 'Request timeout. Please try again.',
  INTERNAL_ERROR: 'Internal server error occurred',
  VALIDATION_ERROR: 'Request validation failed',
  AUTHENTICATION_ERROR: 'Authentication failed',
  AUTHORIZATION_ERROR: 'Authorization failed',
  QUOTA_EXCEEDED: 'API quota exceeded',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable'
};

// Success messages
export const SUCCESS_MESSAGES = {
  TOOL_EXECUTED: 'Tool executed successfully',
  FILE_UPLOADED: 'File uploaded successfully',
  BATCH_CREATED: 'Batch job created successfully',
  CACHE_HIT: 'Response served from cache',
  MODEL_SELECTED: 'Optimal model selected automatically'
};

// Tool descriptions
export const TOOL_DESCRIPTIONS = {
  TEXT_COMPLETION: 'Generate high-quality text completions using Groq\'s fastest LLM models with intelligent routing based on complexity and requirements.',
  AUDIO_TRANSCRIPTION: 'Transcribe audio files to text using Groq\'s Whisper models with support for multiple languages and output formats.',
  VISION_ANALYSIS: 'Analyze images and extract insights using Groq\'s multimodal vision models with customizable analysis types.',
  BATCH_PROCESSING: 'Process large batches of requests efficiently with 25% cost savings and automatic job management.',
  TEXT_TO_SPEECH: 'Synthesize high-quality audio from text using Groq\'s Text-to-Speech models with various voice options.' // Adicionado para TTS
};

// Environment validation
export const REQUIRED_ENV_VARS = [
  'GROQ_API_KEY'
];

export const OPTIONAL_ENV_VARS = [
  'LOG_LEVEL',
  'NODE_ENV',
  'CACHE_ENABLED',
  'METRICS_ENABLED',
  'TEMP_DIR',
  'ALLOWED_ORIGINS',
  'METRICS_ENDPOINT'
];

// Version and build info
export const VERSION_INFO = {
  VERSION: '1.0.0',
  BUILD_DATE: new Date().toISOString(),
  NODE_VERSION: process.version,
  PLATFORM: process.platform,
  ARCH: process.arch
};

// Default configurations for different environments
export const ENV_CONFIGS = {
  development: {
    logLevel: 'debug',
    cacheEnabled: true,
    metricsEnabled: true,
    rateLimitEnabled: false,
    corsEnabled: true
  },
  production: {
    logLevel: 'info',
    cacheEnabled: true,
    metricsEnabled: true,
    rateLimitEnabled: true,
    corsEnabled: false
  },
  test: {
    logLevel: 'error',
    cacheEnabled: false,
    metricsEnabled: false,
    rateLimitEnabled: false,
    corsEnabled: true
  }
};

// Get current environment configuration
export const getCurrentEnvConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return ENV_CONFIGS[env as keyof typeof ENV_CONFIGS] || ENV_CONFIGS.development;
};