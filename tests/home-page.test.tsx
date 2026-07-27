import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('home page', () => {
  it('renders the Personal Finance Tracker heading', () => {
    const page = HomePage();

    expect(page.props.children).toBe('Personal Finance Tracker');
  });
});
