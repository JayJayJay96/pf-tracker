import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Field } from './page';

describe('Field', () => {
  it('names a select by its label alone, not by its options', () => {
    const markup = renderToStaticMarkup(
      <Field label="Range">
        <select name="range">
          <option value="month">Specific month</option>
          <option value="year">Specific year</option>
        </select>
      </Field>,
    );

    /*
     * Without this, a control inside a label takes its name from the label's
     * text, and a select's text is all of its options: the real Range field was
     * announced as "RangeSpecific monthCustom date rangeYear to dateSpecific
     * year", and could not be located by its own label at all.
     */
    expect(markup).toContain('aria-label="Range"');
    expect(markup).toContain('Specific month');
  });

  it('leaves a control that already names itself alone', () => {
    const markup = renderToStaticMarkup(
      <Field label="Month">
        <input aria-label="Month of the report" name="month" type="month" />
      </Field>,
    );

    expect(markup).toContain('aria-label="Month of the report"');
    expect(markup).not.toContain('aria-label="Month"');
  });

  it('still renders the visible label for sighted readers', () => {
    const markup = renderToStaticMarkup(
      <Field label="Payment method">
        <select name="paymentMethod"><option value="cash">Cash</option></select>
      </Field>,
    );

    expect(markup).toContain('>Payment method<');
    expect(markup).toContain('aria-label="Payment method"');
  });

  it('passes anything that is not a single element straight through', () => {
    // Nothing does this today; it must not break if something starts to.
    const markup = renderToStaticMarkup(
      <Field label="Range">
        <input name="from" type="date" />
        <input name="to" type="date" />
      </Field>,
    );

    expect(markup).toContain('name="from"');
    expect(markup).toContain('name="to"');
  });
});
