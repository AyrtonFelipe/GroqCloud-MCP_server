import { Logger } from './logger.js';
import dayjs from 'dayjs';

interface UsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  modelDistribution: Record<string, number>;
  toolUsage: Record<string, number>;
  errorsByType: Record<string, number>;
  responseTimeStats: {
    min: number;
    max: number;
    avg: number;
    total: number;
    count: number;
  };
  rateLimitHits: Record<string, number>;
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  dailyStats: Record<string, Partial<UsageMetrics>>;
}

export class MetricsTracker {
  private metrics: UsageMetrics;
  private logger: Logger;
  private startTime: number;
  
  // ✅ Controle de timers para cleanup adequado
  private metricsIntervalId?: NodeJS.Timeout | undefined;
  private dailyResetTimeoutId?: NodeJS.Timeout | undefined;
  private isDestroyed = false;

  constructor() {
    this.logger = new Logger();
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    
    this.startPeriodicLogging();
    this.scheduleDailyReset();
  }

  private initializeMetrics(): UsageMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      modelDistribution: {},
      toolUsage: {},
      errorsByType: {},
      responseTimeStats: { min: Infinity, max: 0, avg: 0, total: 0, count: 0 },
      rateLimitHits: {},
      cacheStats: { hits: 0, misses: 0, hitRate: 0 },
      dailyStats: {}
    };
  }

  // ✅ Método separado para controle do logging periódico
  private startPeriodicLogging(): void {
    if (this.isDestroyed) return;
    
    this.metricsIntervalId = setInterval(() => {
      if (!this.isDestroyed) {
        this.logMetrics();
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  incrementToolUsage(toolName: string): void {
    if (this.isDestroyed) return;
    
    this.metrics.totalRequests++;
    this.metrics.toolUsage[toolName] = (this.metrics.toolUsage[toolName] || 0) + 1;
    this.updateDailyStats('toolUsage', toolName, 1);
  }

  incrementToolErrors(toolName: string, errorType: string = 'unknown'): void {
    if (this.isDestroyed) return;
    
    this.recordError(toolName, errorType);
  }


  recordSuccess(): void {
    if (this.isDestroyed) return;
    
    this.metrics.successfulRequests++;
    this.updateDailyStats('successfulRequests', 'total', 1);
  }

  recordError(_toolName: string, errorType: string = 'unknown'): void {
    if (this.isDestroyed) return;
    
    this.metrics.failedRequests++;
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    this.updateDailyStats('failedRequests', 'total', 1);
    this.updateDailyStats('errorsByType', errorType, 1);
  }

  recordTokenUsage(input: number, output: number, model: string): void {
    if (this.isDestroyed) return;
    
    this.metrics.tokenUsage.input += input;
    this.metrics.tokenUsage.output += output;
    this.metrics.tokenUsage.total += input + output;
    this.metrics.modelDistribution[model] = (this.metrics.modelDistribution[model] || 0) + 1;
    
    this.updateDailyStats('tokenUsage', 'input', input);
    this.updateDailyStats('tokenUsage', 'output', output);
    this.updateDailyStats('modelDistribution', model, 1);
  }

  recordResponseTime(_toolName: string, duration: number): void {
    if (this.isDestroyed) return;
    
    const stats = this.metrics.responseTimeStats;
    stats.min = Math.min(stats.min, duration);
    stats.max = Math.max(stats.max, duration);
    stats.total += duration;
    stats.count++;
    stats.avg = stats.total / stats.count;
  }

  recordRateLimitHit(key: string): void {
    if (this.isDestroyed) return;
    
    this.metrics.rateLimitHits[key] = (this.metrics.rateLimitHits[key] || 0) + 1;
    this.updateDailyStats('rateLimitHits', key, 1);
  }

  recordCacheHit(): void {
    if (this.isDestroyed) return;
    
    this.metrics.cacheStats.hits++;
    this.updateCacheHitRate();
  }

  recordCacheMiss(): void {
    if (this.isDestroyed) return;
    
    this.metrics.cacheStats.misses++;
    this.updateCacheHitRate();
  }

  private updateCacheHitRate(): void {
    const total = this.metrics.cacheStats.hits + this.metrics.cacheStats.misses;
    this.metrics.cacheStats.hitRate = total > 0 ? this.metrics.cacheStats.hits / total : 0;
  }

  // ✅ CORREÇÃO: Função updateDailyStats corrigida
  private updateDailyStats(category: string, key: string, value: number): void {
    const today: string = dayjs().format('YYYY-MM-DD');

    
    // ✅ Garante que today é uma string válida
    if (!today || typeof today !== 'string') {
      console.error('Invalid date string generated');
      return;
    }
    
    // ✅ Inicializa o objeto do dia se não existir
    if (!this.metrics.dailyStats[today]) {
      this.metrics.dailyStats[today] = {};
    }
    
    // ✅ Obtém referência segura ao objeto do dia
    const dayStats = this.metrics.dailyStats[today];
    if (!dayStats) return;
    
    // ✅ Inicializa a categoria se não existir
    if (!dayStats[category as keyof UsageMetrics]) {
      (dayStats as any)[category] = {};
    }
    
    // ✅ Atualiza o valor com verificação de tipo
    const dailyCategory = (dayStats as any)[category];
    if (dailyCategory && typeof dailyCategory === 'object') {
      dailyCategory[key] = (dailyCategory[key] || 0) + value;
    }
  }
  

  // ✅ CORREÇÃO: scheduleDailyReset com controle adequado
  private scheduleDailyReset(): void {
    if (this.isDestroyed) return;
    
    // Limpa timeout anterior se existir
    this.clearDailyResetTimeout();
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    this.dailyResetTimeoutId = setTimeout(() => {
      if (!this.isDestroyed) {
        this.logDailyReport();
        this.scheduleDailyReset(); // Reagenda para próximo dia
      }
    }, msUntilMidnight);
  }

  private logMetrics(): void {
    if (this.isDestroyed) return;
    
    const uptime = Date.now() - this.startTime;
    const uptimeHours = uptime / (1000 * 60 * 60);
    
    this.logger.info('Metrics Report', {
      type: 'metrics_report',
      uptime: `${uptimeHours.toFixed(2)} hours`,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    });
  }

  private logDailyReport(): void {
    if (this.isDestroyed) return;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    
    const dailyMetrics = this.metrics.dailyStats[dateKey];
    if (dailyMetrics) {
      this.logger.info('Daily Report', {
        type: 'daily_report',
        date: dateKey,
        metrics: dailyMetrics
      });
    }
  }

  async save(): Promise<void> {
    // Aqui você poderia salvar em um banco de dados, arquivo, etc.
    console.log('Saving metrics:', this.metrics);
    // Simula atraso
    await new Promise((resolve) => setTimeout(resolve, 100));
  }


  getMetrics(): UsageMetrics {
    return { ...this.metrics };
  }

  getHealthStatus(): { status: 'healthy' | 'warning' | 'critical'; details: any } {
    const errorRate = this.metrics.totalRequests > 0 
      ? this.metrics.failedRequests / this.metrics.totalRequests 
      : 0;
    
    const avgResponseTime = this.metrics.responseTimeStats.avg;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const details: any = {
      errorRate: (errorRate * 100).toFixed(2) + '%',
      avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
      cacheHitRate: (this.metrics.cacheStats.hitRate * 100).toFixed(2) + '%',
      totalRequests: this.metrics.totalRequests
    };

    if (errorRate > 0.1 || avgResponseTime > 5000) {
      status = 'critical';
      details.issues = [];
      if (errorRate > 0.1) details.issues.push('High error rate');
      if (avgResponseTime > 5000) details.issues.push('High response time');
    } else if (errorRate > 0.05 || avgResponseTime > 2000) {
      status = 'warning';
      details.warnings = [];
      if (errorRate > 0.05) details.warnings.push('Elevated error rate');
      if (avgResponseTime > 2000) details.warnings.push('Elevated response time');
    }

    return { status, details };
  }

  // ✅ NOVO: Métodos de cleanup para prevenção de memory leak
  private clearMetricsInterval(): void {
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = undefined;
    }
  }

  private clearDailyResetTimeout(): void {
    if (this.dailyResetTimeoutId) {
      clearTimeout(this.dailyResetTimeoutId);
      this.dailyResetTimeoutId = undefined;
    }
  }

  // ✅ NOVO: Método público para cleanup completo
  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Limpa todos os timers
    this.clearMetricsInterval();
    this.clearDailyResetTimeout();
    
    // Log final antes de destruir
    this.logMetrics();
    
    console.log('MetricsTracker destroyed successfully');
  }

  // ✅ NOVO: Método para reiniciar se necessário
  public restart(): void {
    if (!this.isDestroyed) {
      this.destroy();
    }
    
    this.isDestroyed = false;
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.startPeriodicLogging();
    this.scheduleDailyReset();
  }

  // ✅ ADIÇÕES ao metrics-tracker.ts para resolver inconsistências


}
