import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MoneyInput } from './money-input';

describe('money input', () => {
  it('offers a decimal keypad without demanding a typed RM prefix', () => {
    const field = renderToStaticMarkup(
      <MoneyInput name="amount" label="Amount" required />,
    );

    // HTML attribute names are case-insensitive; React preserves the JSX casing.
    expect(field).toMatch(/inputmode="decimal"/i);
    // The old field required the literal "RM12.50", which a numeric keypad
    // cannot produce. Nothing may reintroduce that constraint.
    expect(field).not.toContain('pattern=');
    expect(field).not.toContain('placeholder="RM0.00"');
  });

  it('renders RM beside the field and hides it from assistive technology', () => {
    const field = renderToStaticMarkup(
      <MoneyInput name="amount" label="Amount" />,
    );

    expect(field).toContain('aria-hidden="true"');
    expect(field).toContain('>RM</span>');
  });

  it('seeds an existing amount as a bare editable value', () => {
    const field = renderToStaticMarkup(
      <MoneyInput name="amount" label="Amount" defaultSen={1250} />,
    );

    expect(field).toContain('value="12.50"');
    expect(field).not.toContain('value="RM12.50"');
  });

  it('leaves the field empty when there is no amount yet', () => {
    const field = renderToStaticMarkup(
      <MoneyInput name="actualAmount" label="Actual amount" defaultSen={null} />,
    );

    expect(field).toContain('value=""');
  });

  it('describes the expected format when there is no error', () => {
    const field = renderToStaticMarkup(
      <MoneyInput name="amount" label="Amount" />,
    );

    expect(field).toContain('For example 12.50');
    expect(field).toContain('aria-describedby=');
    expect(field).not.toContain('aria-invalid');
  });

  it('mentions the negative form only where a signed amount is meaningful', () => {
    const signed = renderToStaticMarkup(
      <MoneyInput name="amount" label="Adjustment 1 amount" allowNegative />,
    );

    expect(signed).toContain('-0.05 to subtract');
  });

  it('marks the field invalid and shows a server error in place of the hint', () => {
    const field = renderToStaticMarkup(
      <MoneyInput name="amount" label="Amount" error="Enter an amount" />,
    );

    expect(field).toContain('aria-invalid="true"');
    expect(field).toContain('Enter an amount');
    expect(field).not.toContain('For example 12.50');
  });
});
