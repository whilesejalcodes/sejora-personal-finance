import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthAlert, AuthField, AuthHeader, AuthLayout, AuthSubmitButton, AuthUnavailable } from "@/features/auth/auth-ui";
import { useAuth } from "@/features/auth/use-auth";
import { getAuthErrorMessage } from "@/lib/firebase-auth";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, isConfigured, missingConfig } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
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
      const user = await signIn(parsed.data.email, parsed.data.password);
      navigate(user.emailVerified ? "/dashboard" : "/verify-email", { replace: true });
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout showFounderSignature>
      <AuthHeader eyebrow="Welcome back" title="Sign in to Sejora" description="Your financial picture is waiting when you are ready." />
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {!isConfigured && <AuthUnavailable missingConfig={missingConfig} />}
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} disabled={!isConfigured || loading} />
        <div>
          <AuthField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} error={fieldErrors.password} disabled={!isConfigured || loading} />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="auth-link text-xs font-semibold">Forgot password?</Link>
          </div>
        </div>
        <AuthSubmitButton loading={loading} disabled={!isConfigured}>Sign in</AuthSubmitButton>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        New to Sejora? <Link to="/signup" className="auth-link font-semibold">Create an account</Link>
      </p>
    </AuthLayout>
  );
}