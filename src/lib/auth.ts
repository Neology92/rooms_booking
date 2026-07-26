import { supabase } from "./supabase";

// Thin wrappers over Supabase Auth (email + password). v2 accounts foundation.
// Password reset uses Supabase's built-in email (free, low-volume) — fine for the
// occasional reset. Signup returns needsConfirm=true only if the project still
// requires email confirmation (we recommend turning that OFF so signup is instant).

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsConfirm?: boolean;
}

const NO_CLIENT = "Supabase is not configured.";

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: NO_CLIENT };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) return { ok: false, error: error.message };
  // With email confirmation OFF, a session is returned immediately.
  return { ok: true, needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: NO_CLIENT };
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: NO_CLIENT };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: NO_CLIENT };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { ok: false, error: error.message } : { ok: true };
}
