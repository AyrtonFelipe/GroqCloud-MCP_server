import { z } from 'zod';
import Groq from 'groq-sdk';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { CacheManager } from '../utils/cache-manager.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

const TextCompletionSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.string().optional(),
  max_tokens: z.number().min(1).max(8000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
  json_mode: z.boolean().optional(),
  system_prompt: z.string().optional(),
  priority: z.enum(['speed', 'quality', 'cost']).optional()
});

export class TextCompletionTool {
  public readonly name = 'groq_text_completion';
  public readonly description = 'Generate text completions using Groq models with intelligent routing';
  public readonly inputSchema = zodToJsonSchema(TextCompletionSchema, { $refStrategy: 'none', target: 'jsonSchema7' });

  constructor(
    private groq: Groq,
    private logger: Logger,
    private rateLimiter: RateLimiter,
    private cache: CacheManager
  ) {}

  async execute(args: z.infer<typeof TextCompletionSchema>): Promise<any> {
    const validated = TextCompletionSchema.parse(args);
    
    // Intelligent model selection
    const selectedModel = this.selectOptimalModel(validated);
    
    // Check cache first
    const cacheKey = this.generateCacheKey(validated, selectedModel);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.info('Returning cached result', { model: selectedModel });
      return cached;
    }

    // Apply rate limiting for specific model
    await this.rateLimiter.checkLimit(selectedModel);

    const messages = [
      ...(validated.system_prompt ? [{ role: 'system' as const, content: validated.system_prompt }] : []),
      { role: 'user' as const, content: validated.prompt }
    ];

    const requestParams: any = {
      model: selectedModel,
      messages,
      max_tokens: validated.max_tokens || 1000,
      temperature: validated.temperature || 0.7,
      top_p: validated.top_p || 1,
      stream: validated.stream || false
    };

    if (validated.json_mode) {
      requestParams.response_format = { type: 'json_object' };
    }

    try {
      this.logger.info('Making Groq API request', { model: selectedModel, tokens: validated.max_tokens });
      
      const completion = await this.groq.chat.completions.create(requestParams);
      
      const result = {
        content: completion.choices[0]?.message?.content || '',
        model: selectedModel,
        usage: completion.usage,
        finish_reason: completion.choices[0]?.finish_reason,
        timestamp: new Date().toISOString()
      };

      // Cache successful results
      this.cache.set(cacheKey, result, 300); // 5 minutes TTL
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // ✅ CORREÇÃO: Usar 'this.name'
      this.logger.error(`Tool ${this.name} failed`, { error: errorMessage });
    }
  }

  private selectOptimalModel(args: z.infer<typeof TextCompletionSchema>): string {
    if (args.model) return args.model;

    // Intelligent model selection based on priority
    switch (args.priority) {
      case 'speed':
        return 'llama-3.1-8b-instant';
      case 'quality':
        return 'llama-3.1-70b-versatile';
      case 'cost':
        return 'llama-3.1-8b-instant';
      default:
        // Analyze prompt complexity for auto-selection
        const complexity = this.analyzePromptComplexity(args.prompt);
        return complexity > 0.7 ? 'llama-3.1-70b-versatile' : 'llama-3.1-8b-instant';
    }
  }

  private analyzePromptComplexity(prompt: string): number {
    // Simple complexity analysis
    const factors = {
      length: Math.min(prompt.length / 1000, 1),
      keywords: ['analyze', 'explain', 'complex', 'detailed', 'comprehensive'].some(kw => 
        prompt.toLowerCase().includes(kw)
      ) ? 0.3 : 0,
      questions: (prompt.match(/\?/g) || []).length * 0.1
    };

    return Math.min(factors.length + factors.keywords + factors.questions, 1);
  }

  private generateCacheKey(args: z.infer<typeof TextCompletionSchema>, model: string): string {
    const key = `${model}:${args.prompt}:${args.temperature || 0.7}:${args.max_tokens || 1000}`;
    return Buffer.from(key).toString('base64').slice(0, 50);
  }
}