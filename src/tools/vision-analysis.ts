import { z } from 'zod';
import Groq from 'groq-sdk';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

const VisionAnalysisSchema = z.object({
  image_url: z.string().url('Valid image URL is required'),
  prompt: z.string().optional(),
  analysis_type: z.enum(['describe', 'ocr', 'technical', 'creative']).optional(),
  detail_level: z.enum(['low', 'high']).optional(),
  model: z.enum(['llama-4-scout-17b-instruct', 'llama-4-maverick-17b-instruct']).optional(),
  max_tokens: z.number().min(1).max(4000).optional(),
  json_mode: z.boolean().optional()
});

export class VisionAnalysisTool {
  public readonly name = 'groq_vision_analysis';
  public readonly description = 'Analyze images using Groq multimodal models';
  public readonly inputSchema = zodToJsonSchema(VisionAnalysisSchema, { $refStrategy: 'none', target: 'jsonSchema7' });

  constructor(
    private groq: Groq,
    private logger: Logger,
    private rateLimiter: RateLimiter
  ) {}

  async execute(args: z.infer<typeof VisionAnalysisSchema>): Promise<any> {
    const validated = VisionAnalysisSchema.parse(args);
    
    const model = validated.model || 'llama-4-scout-17b-instruct';
    
    // Apply rate limiting for vision models
    await this.rateLimiter.checkLimit(`vision_${model}`);

    const prompt = this.buildPrompt(validated);

    try {
      this.logger.info('Starting vision analysis', { 
        model, 
        analysisType: validated.analysis_type,
        imageUrl: validated.image_url.substring(0, 50) + '...'
      });

      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: validated.image_url,
                detail: validated.detail_level || 'high'
              }
            }
          ]
        }
      ];

      const requestParams: any = {
        model,
        messages,
        max_tokens: validated.max_tokens || 1000,
        temperature: 0.3 // Lower temperature for more consistent vision analysis
      };

      if (validated.json_mode) {
        requestParams.response_format = { type: 'json_object' };
      }

      const completion = await this.groq.chat.completions.create(requestParams);

      const result = {
        analysis: completion.choices[0]?.message?.content || '',
        model,
        analysis_type: validated.analysis_type,
        image_url: validated.image_url,
        usage: completion.usage,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Vision analysis completed', { 
        model, 
        analysisLength: result.analysis.length 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // ✅ CORREÇÃO: Usar 'this.name'
      this.logger.error(`Tool ${this.name} failed`, { error: errorMessage });
    }
  }

  private buildPrompt(args: z.infer<typeof VisionAnalysisSchema>): string {
    if (args.prompt) return args.prompt;

    const prompts = {
      describe: 'Describe this image in detail, including objects, people, setting, colors, and overall composition.',
      ocr: 'Extract and transcribe all text visible in this image. Organize the text logically and indicate its position/context.',
      technical: 'Provide a technical analysis of this image including composition, lighting, quality, and any technical aspects.',
      creative: 'Provide a creative interpretation of this image, including mood, artistic elements, and storytelling aspects.'
    };

    return prompts[args.analysis_type || 'describe'];
  }
}