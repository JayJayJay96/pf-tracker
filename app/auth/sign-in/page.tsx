import { SignInForm } from './sign-in-form';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <h1>Sign in</h1>
      {params.error ? <p role="alert">The sign-in link is invalid or has expired.</p> : null}
      <SignInForm />
    </main>
  );
}
