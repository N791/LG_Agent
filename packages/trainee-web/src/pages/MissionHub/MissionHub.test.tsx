import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MissionHub from './index';
import '@testing-library/jest-dom';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
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
