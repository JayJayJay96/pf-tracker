import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExpenseView } from './expense-view';

describe('personal expense view', () => {
  it('renders quick entry, history filters, audit date, and owner actions', () => {
    const page = renderToStaticMarkup(
      <ExpenseView
        categories={[{ id: 'food', name: 'Food' }]}
        expenses={[{
          id: 'expense-1',
          amountSen: 1250,
          description: 'Backdated lunch',
          merchant: 'Kopitiam',
          transactionDate: '2026-06-30',
          recordedAt: '2026-07-01T04:00:00Z',
          categoryId: 'food',
          categoryName: 'Food',
          paymentMethod: 'tng',
          notes: 'Forgotten yesterday',
        }]}
        filters={{ search: 'lunch', paymentMethod: 'tng' }}
      />,
    );

    expect(page).toContain('Add personal expense');
    expect(page).toContain('Transaction history');
    expect(page.indexOf('Add personal expense')).toBeLessThan(
      page.indexOf('Expense categories'),
    );
    expect(page.indexOf('Expense categories')).toBeLessThan(
      page.indexOf('Transaction history'),
    );
    expect(page).toContain('Backdated lunch');
    expect(page).toContain('Kopitiam');
    expect(page).toContain('RM12.50');
    // Read as a person writes it, with the stored form kept in the datetime
    // attribute so the markup stays machine readable.
    expect(page).toContain('30 Jun 2026');
    expect(page).toContain('dateTime="2026-06-30"');
    expect(page).toContain('Recorded');
    expect(page).toContain('Edit Backdated lunch');
    // Deletion is armed by an explicit danger-styled button rather than hidden
    // behind a <details> whose summary was itself the confirmation question.
    expect(page).toContain('Delete Backdated lunch');
    expect(page).toContain('danger-button');
    expect(page).toContain('Search description or merchant');
    expect(page).not.toContain('Shared expense');
  });

  it('totals the rows the filters left, so a filter answers a question', () => {
    const page = renderToStaticMarkup(
      <ExpenseView
        categories={[{ id: 'food', name: 'Food' }]}
        expenses={[
          {
            id: 'expense-1',
            amountSen: 1250,
            description: 'Nasi lemak',
            merchant: null,
            transactionDate: '2026-07-15',
            recordedAt: '2026-07-15T04:00:00Z',
            categoryId: 'food',
            categoryName: 'Food',
            paymentMethod: 'tng',
            notes: null,
          },
          {
            id: 'expense-2',
            amountSen: 480,
            description: 'Kopi',
            merchant: null,
            transactionDate: '2026-07-16',
            recordedAt: '2026-07-16T04:00:00Z',
            categoryId: 'food',
            categoryName: 'Food',
            paymentMethod: 'cash',
            notes: null,
          },
        ]}
        filters={{ categoryId: 'food' }}
      />,
    );

    expect(page).toContain('2 expenses');
    expect(page).toContain('RM17.30');
  });

  it('counts one row in the singular', () => {
    const page = renderToStaticMarkup(
      <ExpenseView
        categories={[{ id: 'food', name: 'Food' }]}
        expenses={[{
          id: 'expense-1',
          amountSen: 1250,
          description: 'Nasi lemak',
          merchant: null,
          transactionDate: '2026-07-15',
          recordedAt: '2026-07-15T04:00:00Z',
          categoryId: 'food',
          categoryName: 'Food',
          paymentMethod: 'tng',
          notes: null,
        }]}
        filters={{}}
      />,
    );

    expect(page).toContain('1 expense');
    expect(page).not.toContain('1 expenses');
  });
});
