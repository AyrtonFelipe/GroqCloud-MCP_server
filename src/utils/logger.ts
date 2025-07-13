import winston from 'winston';
import path from 'path';
import fs from 'fs';

export class Logger {
  private logger: winston.Logger;

  constructor() {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'groq-mcp-server' },
      transports: [
        // Write all logs with importance level of 'error' or less to error.log
        new winston.transports.File({ 
          filename: path.join(logsDir, 'error.log'), 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        // Write all logs with importance level of 'info' or less to combined.log
        new winston.transports.File({ 
          filename: path.join(logsDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.Console({
          // MUDANÇA PRINCIPAL:
          // Direcionar todos os níveis de log do console para stderr.
          // Isso mantém o stdout limpo para a comunicação JSON do MCP.
          stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
          format: winston.format.combine(
            winston.format.colorize(), // Mantém as cores no console
            winston.format.simple() // Formato simples para console
          )
        })
      ]
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
    );

    this.logger.rejections.handle(
      new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
    );
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  // Structured logging for API calls
  logApiCall(method: string, endpoint: string, duration: number, success: boolean, meta?: any): void {
    this.logger.info('API Call', {
      type: 'api_call',
      method,
      endpoint,
      duration,
      success,
      ...meta
    });
  }

  // Structured logging for tool execution
  logToolExecution(toolName: string, duration: number, success: boolean, meta?: any): void {
    this.logger.info('Tool Execution', {
      type: 'tool_execution',
      tool: toolName,
      duration,
      success,
      ...meta
    });
  }

  // Structured logging for rate limiting events
  logRateLimit(key: string, remaining: number, resetTime: number): void {
    this.logger.warn('Rate Limit Event', {
      type: 'rate_limit',
      key,
      remaining,
      resetTime
    });
  }
}
