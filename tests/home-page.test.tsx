import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('home page', () => {
  it('renders the Personal Finance Tracker heading', () => {
    const page = renderToStaticMarkup(<HomePage />);

    expect(page).toContain('<h1>Personal Finance Tracker</h1>');
  });
});
