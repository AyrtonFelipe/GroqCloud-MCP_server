import { z } from 'zod';
import Groq from 'groq-sdk';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import fs from 'fs';
import { zodToJsonSchema } from 'zod-to-json-schema';

const AudioTranscriptionSchema = z.object({
  audio_file: z.string().min(1, 'Audio file path is required'),
  model: z.enum(['whisper-large-v3', 'whisper-large-v3-turbo']).optional(),
  language: z.string().optional(),
  prompt: z.string().optional(),
  response_format: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).optional(),
  temperature: z.number().min(0).max(1).optional(),
  translate: z.boolean().optional()
});

export class AudioTranscriptionTool {
  public readonly name = 'groq_audio_transcription';
  public readonly description = 'Transcribe audio files using Groq Whisper models';
  public readonly inputSchema = zodToJsonSchema(AudioTranscriptionSchema, { $refStrategy: 'none', target: 'jsonSchema7' });

  constructor(
    private groq: Groq,
    private logger: Logger,
    private rateLimiter: RateLimiter
  ) {}

  async execute(args: z.infer<typeof AudioTranscriptionSchema>): Promise<any> {
    const validated = AudioTranscriptionSchema.parse(args);
    
    // Validate file exists
    if (!fs.existsSync(validated.audio_file)) {
      throw new Error(`Audio file not found: ${validated.audio_file}`);
    }

    const model = validated.model || 'whisper-large-v3-turbo';
    
    // Apply rate limiting for audio processing
    await this.rateLimiter.checkLimit(`audio_${model}`);

    try {
      this.logger.info('Starting audio transcription', { 
        file: validated.audio_file, 
        model,
        language: validated.language 
      });

      const audioFile = fs.createReadStream(validated.audio_file);
      
      const transcriptionParams: any = {
        file: audioFile,
        model,
        response_format: validated.response_format || 'json',
        temperature: validated.temperature || 0
      };

      if (validated.language) {
        transcriptionParams.language = validated.language;
      }

      if (validated.prompt) {
        transcriptionParams.prompt = validated.prompt;
      }

      const transcription = validated.translate 
        ? await this.groq.audio.translations.create(transcriptionParams)
        : await this.groq.audio.transcriptions.create(transcriptionParams);

      const result = {
        transcription: typeof transcription === 'string' ? transcription : transcription.text,
        model,
        language: validated.language,
        duration: await this.getAudioDuration(validated.audio_file),
        timestamp: new Date().toISOString()
      };

      this.logger.info('Audio transcription completed', { 
        model, 
        textLength: result.transcription.length 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // ✅ CORREÇÃO: Usar 'this.name'
      this.logger.error(`Tool ${this.name} failed`, { error: errorMessage });
    }
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    try {
      const stats = fs.statSync(filePath);
      // Simple estimation based on file size (this could be improved with actual audio analysis)
      return Math.round(stats.size / 16000); // Rough estimate for common formats
    } catch {
      return 0;
    }
  }
}