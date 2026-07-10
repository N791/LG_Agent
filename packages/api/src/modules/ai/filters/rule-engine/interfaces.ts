export type RuleType = 'REGEX' | 'KEYWORD';
export type RuleAction = 'ALLOW' | 'MASK' | 'BLOCK' | 'WARN' | 'LOG_ONLY';
export type RuleScope = 'request' | 'response';

export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  action: RuleAction;
  scope: RuleScope;
  pattern: string;
  replacement?: string;
  priority: number;
  enabled: boolean;
}

export interface MatchResult {
  matched: boolean;
  content: string;
  triggeredRules: Rule[];
}

export interface IActionExecutor {
  readonly action: RuleAction;
  execute(content: string, match: string, rule: Rule): string;
}

export interface IMatcher {
  readonly type: RuleType;
  match(content: string, rule: Rule, executors: Map<RuleAction, IActionExecutor>): MatchResult;
}

export interface IFilterRuleRepository {
  getRules(scope: RuleScope): Promise<Rule[]>;
}
