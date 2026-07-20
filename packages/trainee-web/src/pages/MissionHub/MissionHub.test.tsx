import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MissionHub from './index';
import '@testing-library/jest-dom';

vi.mock('../../utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

vi.mock('../../services/courseService', () => ({
  courseService: {
    getCourse: vi.fn().mockResolvedValue({ title: 'Mission Hub', description: 'Test course' }),
  },
}));

vi.mock('../../services/trainingService', () => ({
  trainingService: {
    getProgress: vi.fn().mockResolvedValue({ totalTasks: 10, completedTasks: 5, progressPercentage: 50 }),
    getRecentLearning: vi.fn().mockResolvedValue(null),
  },
}));

describe('MissionHub', () => {
  it('renders without crashing and shows the main title', async () => {
    render(
      <BrowserRouter>
        <MissionHub />
      </BrowserRouter>,
    );
    expect(await screen.findByText('Mission Hub')).toBeInTheDocument();
  });
});
