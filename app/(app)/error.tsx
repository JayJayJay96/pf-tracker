'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>We could not load your financial plan</h1>
      <p role="alert">Your financial data was not displayed. Please try again.</p>
      <button type="button" onClick={reset}>Try again</button>
    </main>
  );
}
