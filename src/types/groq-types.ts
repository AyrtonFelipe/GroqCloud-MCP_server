// src/types/groq-types.ts

export type ModelCapability = 'text' | 'vision' | 'function_calling' | 'json_mode';

export interface GroqModel {
  id: string;
  name: string;
  description: string;
  capabilities: ModelCapability[];
  contextLength: number;
  maxTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  speedRating: number;  // 1-10 scale
  qualityRating: number;  // 1-10 scale
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface GroqChatMessage {
  role: MessageRole;
  content: string | GroqMessageContent[];
  name?: string;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

export interface GroqMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high';
  };
}

export interface GroqToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GroqChatCompletionRequest {
  model: string;
  messages: GroqChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  response_format?: {
    type: 'text' | 'json_object';
  };
  tools?: GroqTool[];
  tool_choice?: 'none' | 'auto' | 'required' | { 
    type: 'function'; 
    function: { name: string } 
  };
}

export interface GroqTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  };
}

export interface GroqChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: GroqChoice[];
  usage: GroqUsage;
  system_fingerprint?: string;
}

export interface GroqChoice {
  index: number;
  message: GroqChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: any;
}

export interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GroqTranscriptionRequest {
  file: File | Blob;
  model: 'whisper-large-v3' | 'whisper-large-v3-turbo';
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface GroqTranscriptionResponse {
  text: string;
  task?: string;
  language?: string;
  duration?: number;
  segments?: GroqTranscriptionSegment[];
}

export interface GroqTranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface GroqBatchRequest {
  custom_id: string;
  method: 'POST';
  url: '/v1/chat/completions';
  body: GroqChatCompletionRequest;
}

export interface GroqBatch {
  id: string;
  object: 'batch';
  endpoint: string;
  errors?: any;
  input_file_id: string;
  completion_window: '24h' | '7d';
  status: 'validating' | 'failed' | 'in_progress' | 'finalizing' | 'completed' | 'expired' | 'cancelling' | 'cancelled';
  output_file_id?: string;
  error_file_id?: string;
  created_at: number;
  in_progress_at?: number;
  expires_at?: number;
  finalizing_at?: number;
  completed_at?: number;
  failed_at?: number;
  expired_at?: number;
  cancelling_at?: number;
  cancelled_at?: number;
  request_counts: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: Record<string, string>;
}

export interface GroqError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface GroqRateLimitHeaders {
  'x-ratelimit-limit-requests': string;
  'x-ratelimit-limit-tokens': string;
  'x-ratelimit-remaining-requests': string;
  'x-ratelimit-remaining-tokens': string;
  'x-ratelimit-reset-requests': string;
  'x-ratelimit-reset-tokens': string;
}
