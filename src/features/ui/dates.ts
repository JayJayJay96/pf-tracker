/**
 * Date display, in one place.
 *
 * Records were mixing two forms: a row printed the stored `2026-07-15` for the
 * date the money moved, then a formatted `30 Jul 2026, 6:06 pm` for when it was
 * keyed in, two lines below. The stored form is what a database wants, not what a
 * reader wants, and both inside one record read as two unrelated fields.
 */

/**
 * A calendar date, e.g. `15 Jul 2026`.
 *
 * Formatted in UTC deliberately. These values carry no time of day, so reading
 * them in a zone behind UTC would shift them to the previous day.
 */
export function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

/**
 * A moment, e.g. `30 Jul 2026, 6:06 pm`.
 *
 * Kuala Lumpur, because this answers "when did I key this in", which the owner
 * recalls in their own day rather than in UTC.
 */
export function displayDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(value));
}
