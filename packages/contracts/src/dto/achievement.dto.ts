export interface BadgeDTO {
  badgeCode: string;
  awardedAt: string;
}

export interface AchievementDTO {
  totalPoints: number;
  badges: BadgeDTO[];
}
