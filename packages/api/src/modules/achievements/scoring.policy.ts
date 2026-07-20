import { TaskDifficulty } from '@lg-agent/contracts';

export interface IScoringPolicy {
  calculatePoints(difficulty: TaskDifficulty): number;
}

export class DefaultScoringPolicy implements IScoringPolicy {
  calculatePoints(difficulty: TaskDifficulty): number {
    switch (difficulty) {
      case TaskDifficulty.BEGINNER:
        return 100;
      case TaskDifficulty.INTERMEDIATE:
        return 200;
      case TaskDifficulty.ADVANCED:
        return 300;
      default:
        return 0;
    }
  }
}
