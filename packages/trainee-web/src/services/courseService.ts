import request from '../utils/request';

export interface CourseDTO {
  id: string;
  title: string;
  description?: string;
  version: string;
  status: number;
  requiredPoints?: number;
}

class CourseService {
  async getCourse(courseId: string): Promise<CourseDTO> {
    const response = await request.get<CourseDTO>(`/courses/${courseId}`);
    const data = (response as unknown as { data?: CourseDTO })?.data ?? response;
    return data as CourseDTO;
  }
}

export const courseService = new CourseService();
