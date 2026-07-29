import { SignInForm } from './sign-in-form';

export const metadata = {
  title: 'Sign in',
};

type SignInPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-12">
      <div className="grid gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Sign in</h1>
        <p className="text-sm text-ink-muted">Your private finance tracker.</p>
      </div>
      {params.error ? (
        <p
          className="rounded-lg border border-negative/50 bg-negative/10 px-3.5 py-2.5 text-sm font-semibold text-negative"
          role="alert"
        >
          The sign-in link is invalid or has expired.
        </p>
      ) : null}
      <SignInForm />
    </main>
  );
}
