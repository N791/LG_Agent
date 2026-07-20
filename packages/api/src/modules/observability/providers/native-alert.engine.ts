import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  AlertEngine, 
  AlertRule, 
  ALERT_CHANNEL, 
  AlertSeverity,
} from '../interfaces/alert-engine.interface';
import type { AlertEvent, AlertChannel } from '../interfaces/alert-engine.interface';

@Injectable()
export class NativeLogAlertChannel implements AlertChannel {
  private readonly logger = new Logger(NativeLogAlertChannel.name);

  sendAlert(event: AlertEvent): Promise<void> {
    const msg = `[ALERT] [${event.severity}] Rule: ${event.ruleName} | Triggered at: ${event.timestamp.toISOString()}`;
    if (event.severity === AlertSeverity.CRITICAL) {
      this.logger.error(msg, JSON.stringify(event.details));
    } else if (event.severity === AlertSeverity.WARNING) {
      this.logger.warn(msg);
    } else {
      this.logger.log(msg);
    }
    return Promise.resolve();
  }
}

@Injectable()
export class NativeAlertEngine implements AlertEngine {
  private rules: AlertRule[] = [];
  private readonly logger = new Logger(NativeAlertEngine.name);

  constructor(
    @Inject(ALERT_CHANNEL)
    private readonly alertChannel: AlertChannel,
  ) {}

  registerRule(rule: AlertRule): void {
    this.rules.push(rule);
    this.logger.log(`Registered alert rule: ${rule.name}`);
  }

  // Runs every 1 minute to check rules.
  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateRules(): Promise<void> {
    for (const rule of this.rules) {
      try {
        const isTriggered = await rule.condition();
        if (isTriggered) {
          const event: AlertEvent = {
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            timestamp: new Date(),
          };
          await this.alertChannel.sendAlert(event);
        }
      } catch (err) {
        this.logger.error(`Failed to evaluate alert rule ${rule.name}`, err);
      }
    }
  }
}
