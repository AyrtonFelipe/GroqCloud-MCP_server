import { z } from 'zod';
import Groq from 'groq-sdk';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { v4 as uuidv4 } from 'uuid';
import { zodToJsonSchema } from 'zod-to-json-schema';

const BatchProcessingSchema = z.object({
  requests: z.array(z.object({
    custom_id: z.string().optional(),
    method: z.literal('POST'),
    url: z.literal('/v1/chat/completions'),
    body: z.object({
      model: z.string(),
      messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string()
      })),
      max_tokens: z.number().optional(),
      temperature: z.number().optional()
    })
  })).min(1).max(50000),
  completion_window: z.enum(['24h', '7d']).optional(),
  metadata: z.record(z.string()).optional()
});

export class BatchProcessingTool {
  public readonly name = 'groq_batch_processing';
  public readonly description = 'Process large batches of requests with 25% discount';
  public readonly inputSchema = zodToJsonSchema(BatchProcessingSchema, { $refStrategy: 'none', target: 'jsonSchema7' });

  constructor(
    private groq: Groq,
    private logger: Logger,
    private rateLimiter: RateLimiter
  ) {}

  async execute(args: z.infer<typeof BatchProcessingSchema>): Promise<any> {
    const validated = BatchProcessingSchema.parse(args);
    
    // Apply rate limiting for batch operations
    await this.rateLimiter.checkLimit('batch_processing');

    // Add custom IDs to requests that don't have them
    const requestsWithIds = validated.requests.map(req => ({
      ...req,
      custom_id: req.custom_id || uuidv4()
    }));

    try {
      this.logger.info('Starting batch processing', { 
        requestCount: requestsWithIds.length,
        completionWindow: validated.completion_window || '24h'
      });

      // Create batch file content
      const batchContent = requestsWithIds
        .map(req => JSON.stringify(req))
        .join('\n');

      // Create batch job
      const batch = await this.groq.batches.create({
        input_file_id: await this.uploadBatchFile(batchContent),
        endpoint: '/v1/chat/completions',
        completion_window: validated.completion_window || '24h',
        metadata: validated.metadata || {}
      });

      const result = {
        batch_id: batch.id,
        status: batch.status,
        request_count: requestsWithIds.length,
        completion_window: validated.completion_window || '24h',
        created_at: batch.created_at,
        estimated_completion: this.calculateEstimatedCompletion(
          validated.completion_window || '24h'
        ),
        cost_savings: '25% discount applied',
        timestamp: new Date().toISOString()
      };

      this.logger.info('Batch processing initiated', { 
        batchId: batch.id,
        requestCount: requestsWithIds.length
      });

      return result;

    }catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // ✅ CORREÇÃO: Usar 'this.name'
      this.logger.error(`Tool ${this.name} failed`, { error: errorMessage });
    }
  }

  private async uploadBatchFile(content: string): Promise<string> {
    // Convert content to file-like object
    const blob = new Blob([content], { type: 'application/jsonl' });
    const file = new File([blob], 'batch_requests.jsonl', { type: 'application/jsonl' });

    const upload = await this.groq.files.create({
      file: file,
      purpose: 'batch'
    });   
      if (!upload.id) {
    throw new Error('Upload ID não foi retornado pela API');
        }
  return upload.id;
  }

  private calculateEstimatedCompletion(window: string): string {
    const now = new Date();
    const hours = window === '24h' ? 24 : 168; // 7 days = 168 hours
    const completion = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return completion.toISOString();
  }
}