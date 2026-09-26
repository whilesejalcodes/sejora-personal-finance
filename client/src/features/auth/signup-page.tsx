import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthAlert, AuthField, AuthHeader, AuthLayout, AuthSubmitButton, AuthUnavailable } from "@/features/auth/auth-ui";
import { useAuth } from "@/features/auth/use-auth";
import { getAuthErrorMessage } from "@/lib/firebase-auth";

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your password."),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp, isConfigured, missingConfig } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = signupSchema.safeParse({ email, password, confirmPassword });
    if (!parsed.success) {
      const nextErrors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof typeof nextErrors;
        nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await signUp(parsed.data.email, parsed.data.password);
      navigate("/verify-email", { replace: true });
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout showFounderSignature>
      <AuthHeader eyebrow="Start with clarity" title="Create your Sejora account" description="Set up your private workspace for a clearer view of your money." />
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {!isConfigured && <AuthUnavailable missingConfig={missingConfig} />}
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} disabled={!isConfigured || loading} />
        <AuthField label="Password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} error={fieldErrors.password} disabled={!isConfigured || loading} />
        <AuthField label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} error={fieldErrors.confirmPassword} disabled={!isConfigured || loading} />
        <AuthSubmitButton loading={loading} disabled={!isConfigured}>Create account</AuthSubmitButton>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="auth-link font-semibold">Sign in</Link>
      </p>
    </AuthLayout>
  );
}