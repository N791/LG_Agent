import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../../src/App';

describe('App Smoke Test', () => {
  it('should render the App component successfully', () => {
    render(<App />);
    // Smoke Test: 验证根组件能渲染且 DOM 不为空
    expect(document.body).not.toBeEmptyDOMElement();
  });
});
