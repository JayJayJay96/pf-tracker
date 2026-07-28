type PasswordAuthClient = {
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{ error: unknown }>;
  };
};

export type PasswordSignInResult =
  | { ok: true; redirectTo: '/' }
  | { ok: false; message: string };

export async function signInWithPassword(
  supabase: PasswordAuthClient,
  email: string,
  password: string,
): Promise<PasswordSignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: 'Email or password is incorrect.' };
  }

  return { ok: true, redirectTo: '/' };
}
