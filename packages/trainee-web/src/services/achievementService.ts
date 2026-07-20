import request from '../utils/request';
import { AchievementDTO } from '@lg-agent/contracts';

class AchievementService {
  async getMyAchievements(): Promise<AchievementDTO> {
    const response = await request.get<AchievementDTO>('/achievements/me');
    const data = (response as unknown as { data?: AchievementDTO }).data ?? response;
    return data as AchievementDTO;
  }
}

export const achievementService = new AchievementService();
