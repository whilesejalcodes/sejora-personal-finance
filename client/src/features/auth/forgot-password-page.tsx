import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { AuthAlert, AuthField, AuthHeader, AuthLayout, AuthSubmitButton, AuthUnavailable } from "@/features/auth/auth-ui";
import { useAuth } from "@/features/auth/use-auth";
import { getAuthErrorMessage } from "@/lib/firebase-auth";

const resetSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export function ForgotPasswordPage() {
  const { sendResetEmail, isConfigured, missingConfig } = useAuth();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSent(false);
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setLoading(true);
    try {
      await sendResetEmail(parsed.data.email);
      setSent(true);
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeader eyebrow="Account recovery" title="Reset your password" description="Enter your email and Firebase will send a secure password reset link." />
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {!isConfigured && <AuthUnavailable missingConfig={missingConfig} />}
        {sent && <AuthAlert>Check your inbox for a password reset link. If an account exists for that address, Firebase will send it securely.</AuthAlert>}
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError} disabled={!isConfigured || loading} />
        <AuthSubmitButton loading={loading} disabled={!isConfigured}>Send reset email</AuthSubmitButton>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        Remembered it? <Link to="/login" className="auth-link font-semibold">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}