import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  ListResourcesRequestSchema, 
  ListPromptsRequestSchema    
} from '@modelcontextprotocol/sdk/types.js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { Logger } from './utils/logger.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { CacheManager } from './utils/cache-manager.js';
import { MetricsTracker } from './utils/metrics-tracker.js';
import { ErrorHandler } from './utils/error-handler.js';
import { TextCompletionTool } from './tools/text-completion.js';
import { AudioTranscriptionTool } from './tools/audio-transcription.js';
import { VisionAnalysisTool } from './tools/vision-analysis.js';
import { BatchProcessingTool } from './tools/batch-processing.js';
import {RATE_LIMITS } from './config/constants.js';

dotenv.config();

class GroqMCPServer {
  private server: Server;
  private groq: Groq;
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private cache: CacheManager;
  private metrics: MetricsTracker;
 // private gmodels: typeof GROQ_MODELS;
  private errorHandler: ErrorHandler;
  private tools: Map<string, any>;
  private isShuttingDown: boolean = false;

  constructor() {
    // Validação da API key (mantém compatibilidade)
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY environment variable is required');
      process.exit(1);
    }

    this.server = new Server(
      {
        name: 'groq-mcp-server',
        version: '1.0.7',
        description: 'MCP server inteligente que acessa a API GROQ invocando varios modelos de LLM'
      },
      {
        capabilities: {
          tools: {},
          logging: {},  
          resources: {}, 
          prompts: {}   
        }
      }
    );

    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 30000,
      maxRetries: 3
    });

    this.logger = new Logger();
    this.rateLimiter = new RateLimiter(RATE_LIMITS);
    this.cache = new CacheManager();
    this.metrics = new MetricsTracker();
    this.errorHandler = new ErrorHandler(this.logger);
   // this.gmodels = GROQ_MODELS;
    this.tools = new Map();

    this.initializeTools();
    this.setupHandlers();
    this.setupGracefulShutdown();
  }

  private initializeTools(): void {
    try {
      const toolInstances = [
        new TextCompletionTool(this.groq, this.logger, this.rateLimiter, this.cache),
        new AudioTranscriptionTool(this.groq, this.logger, this.rateLimiter),
        new VisionAnalysisTool(this.groq, this.logger, this.rateLimiter),
        new BatchProcessingTool(this.groq, this.logger, this.rateLimiter)
      ];

      toolInstances.forEach(tool => {
        // Validação básica mais flexível
        if (tool && tool.name) {
          this.tools.set(tool.name, tool);
        } else {
          this.logger?.warn?.('Skipping invalid tool during initialization');
        }
      });

      this.logger?.info?.(`Successfully initialized ${this.tools.size} tools`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error?.('Failed to initialize tools', { error: errorMessage });
      // Não lance erro para manter compatibilidade
      console.error('Tool initialization error:', errorMessage);
    }
  }

  private setupHandlers(): void {
    // Handler para listar ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools: Tool[] = Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description || 'No description available',
          inputSchema: tool.inputSchema // Já corrigido para ser JSON Schema
        }));
  
        this.logger.info(`Listed ${tools.length} available tools`, { context: 'ListToolsHandler' });
        return { tools };
      } catch (error) {
        const errorMessage = ErrorHandler.handle(error);
        const errorStack = ErrorHandler.getStack(error);
        this.logger.error('Error listing tools', {
          error: errorMessage,
          stack: errorStack,
          context: 'ListToolsHandler'
        });
        return { tools: [] };
      }
    });
  
    // Handler para executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();
    
      try {
        this.logger.info(`Executing tool: ${name}`, { args, context: 'CallToolHandler' });
    
        if (this.isShuttingDown) {
          throw new Error('Server is shutting down');
        }
    
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`);
        }
    


        // const modelInfo = this.gmodels[name];
        // if (!modelInfo && name !== 'groq_batch_processing' && name !== 'groq_audio_transcription' && name !== 'groq_vision_analysis') {
        //     throw new Error(`Unsupported model or tool not configured in GROQ_MODELS: ${name}`);
        // }
    
        await this.rateLimiter.checkLimit(name);
    
        this.metrics.incrementToolUsage(name);
        
        const result = await this.errorHandler.withRetry(
          () => tool.execute(args),
          3
        );
    
        const duration = Date.now() - startTime;
    
        this.metrics.recordResponseTime(name, duration);
    
        this.logger.info(`Tool ${name} executed successfully`, { duration, context: 'CallToolHandler' });
    
        return {
          content: [
            {
              type: 'text',
              text: this.formatResult(result)
            }
          ]
        };
    
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = ErrorHandler.handle(error);
        const errorStack = ErrorHandler.getStack(error);
    
        this.logger.error(`Tool ${name} failed`, {
          error: errorMessage,
          stack: errorStack,
          duration,
          args: this.sanitizeArgs(args),
          context: `CallToolHandler - ${name}`
        });
    
        this.metrics.incrementToolErrors(name, errorMessage);
  
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  
    // NOVOS HANDLERS PARA EVITAR "METHOD NOT FOUND"
    // Handler para listar recursos (mock vazio)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      this.logger.debug('Received ListResourcesRequest, returning empty list', { context: 'ListResourcesHandler' });
      return { resources: [] };
    });
  
    // Handler para listar prompts (mock vazio)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      this.logger.debug('Received ListPromptsRequest, returning empty list', { context: 'ListPromptsHandler' });
      return { prompts: [] };
    });
  }

  private formatResult(result: any): string {
    if (typeof result === 'string') {
      return result;
    }
    
    if (result === null || result === undefined) {
      return 'No result returned';
    }

    try {
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return String(result);
    }
  }

  private sanitizeArgs(args: any): any {
    // Remove informações sensíveis dos logs de forma segura
    if (typeof args === 'object' && args !== null) {
      try {
        const sanitized = { ...args };
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'key'];
        
        for (const field of sensitiveFields) {
          if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
          }
        }
        
        return sanitized;
      } catch (error) {
        return '[ARGS_SANITIZATION_ERROR]';
      }
    }
    
    return args;
  }

  private setupGracefulShutdown(): void {
    const handleShutdown = async (signal: string) => {
      this.logger?.info?.(`Received ${signal}, starting graceful shutdown...`);
      this.isShuttingDown = true;
      
      try {
        // Dar tempo para requisições em andamento terminarem
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Limpar recursos de forma segura
        await this.cleanup();
        
        this.logger?.info?.('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger?.error?.('Error during shutdown', { error: errorMessage });
        process.exit(1);
      }
    };

    // Configurar handlers de shutdown apenas se não existirem
    if (process.listenerCount('SIGTERM') === 0) {
      process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }
    
    if (process.listenerCount('SIGINT') === 0) {
      process.on('SIGINT', () => handleShutdown('SIGINT'));
    }
    
    // Handlers de erro global
    process.on('uncaughtException', (error) => {
      this.logger?.error?.('Uncaught exception', { error: error.message, stack: error.stack });
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      this.logger?.error?.('Unhandled rejection', { reason: String(reason) });
      console.error('Unhandled Rejection:', reason);
      process.exit(1);
    });
  }

  private async cleanup(): Promise<void> {
    try {
      // Limpar cache se o método existir
      if (this.cache && typeof this.cache.clear === 'function') {
        await this.cache.clear();
      }
      // Salvar métricas se o método existir
      if (this.metrics && typeof this.metrics.save === 'function') {
        await this.metrics.save();
      }
      this.logger?.info?.('Cleanup completed successfully');
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error?.('Error during cleanup', { error: errorMessage });
    }
  }

  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('MCP server transport connected and listening.', { context: 'Startup' }); // Novo log
      this.logger?.info?.('Groq MCP Server started successfully', { /* ... */ });
    

      // Log das ferramentas disponíveis
      if (this.tools.size > 0) {
        this.logger?.info?.('Available tools:', {
          tools: Array.from(this.tools.keys())
        });
      } else {
        this.logger?.warn?.('No tools available');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error?.('Failed to start server', { error: errorMessage });
      console.error('Server start error:', errorMessage);
      throw error;
    }
  }
}


const externalLogger = new Logger();
async function main() {
  const serverInstance = new GroqMCPServer(); // Cria a instância aqui

  try {
    await serverInstance.start(); // Inicia o servidor
  } catch (err) {
    // ✅ CORREÇÃO AQUI: Usar o 'externalLogger' que está no escopo global
    externalLogger.error('Unhandled server startup error during main execution', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      context: 'MainExecution'
    });
    process.exit(1);
  }
}

// ✅ Executa a função principal para iniciar tudo
main().catch(error => {
    // Este catch é para erros que possam ocorrer no próprio `main` *antes*
    // do externalLogger ser totalmente inicializado ou para erros
    // muito graves que o `externalLogger` não conseguiu capturar.
    // É um fallback de último recurso para console.error.
    console.error('Critical error in main execution loop, falling back to console:', error);
    process.exit(1);
});