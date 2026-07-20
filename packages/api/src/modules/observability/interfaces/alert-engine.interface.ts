export const ALERT_ENGINE = 'ALERT_ENGINE';
export const ALERT_CHANNEL = 'ALERT_CHANNEL';

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  severity: AlertSeverity;
  condition: () => Promise<boolean> | boolean; // true means alert should fire
}

export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  timestamp: Date;
  details?: any;
}

export interface AlertChannel {
  sendAlert(event: AlertEvent): Promise<void>;
}

export interface AlertEngine {
  registerRule(rule: AlertRule): void;
  evaluateRules(): Promise<void>;
}
