import { Injectable } from '@nestjs/common';
import type { RuntimeLanguage } from '@lg-agent/contracts';
import { Counter, Histogram, register } from 'prom-client';

interface Labels {
  language: RuntimeLanguage;
  version: string;
}

@Injectable()
export class RuntimeMetricsService {
  private readonly execution = histogram(
    'sandbox_runtime_execution_seconds',
    'Sandbox execution duration by runtime.',
    ['language', 'version', 'action'],
  );
  private readonly queue = histogram(
    'sandbox_runtime_queue_seconds',
    'Queue wait duration by runtime.',
    ['language', 'version'],
  );
  private readonly imagePull = histogram(
    'sandbox_runtime_image_pull_seconds',
    'Image pull/start duration by runtime.',
    ['language', 'version'],
  );
  private readonly cache = counter(
    'sandbox_runtime_dependency_cache_total',
    'Dependency cache result by runtime.',
    ['language', 'version', 'result'],
  );
  private readonly failures = counter(
    'sandbox_runtime_failures_total',
    'Sandbox failures by runtime and stable reason.',
    ['language', 'version', 'reason'],
  );

  observeExecution(labels: Labels, action: string, seconds: number): void {
    this.execution.labels(labels.language, labels.version, action).observe(seconds);
  }

  observeQueue(labels: Labels, seconds: number): void {
    this.queue.labels(labels.language, labels.version).observe(seconds);
  }

  observeImagePull(labels: Labels, seconds: number): void {
    this.imagePull.labels(labels.language, labels.version).observe(seconds);
  }

  recordCache(labels: Labels, hit: boolean): void {
    this.cache.labels(labels.language, labels.version, hit ? 'hit' : 'miss').inc();
  }

  recordFailure(labels: Labels, reason: string): void {
    this.failures.labels(labels.language, labels.version, reason).inc();
  }
}

function histogram(name: string, help: string, labelNames: string[]): Histogram {
  return (
    (register.getSingleMetric(name) as Histogram | undefined) ??
    new Histogram({ name, help, labelNames })
  );
}

function counter(name: string, help: string, labelNames: string[]): Counter {
  return (
    (register.getSingleMetric(name) as Counter | undefined) ??
    new Counter({ name, help, labelNames })
  );
}
