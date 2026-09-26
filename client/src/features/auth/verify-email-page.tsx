import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthAlert, AuthHeader, AuthLayout, AuthSubmitButton } from "@/features/auth/auth-ui";
import { useAuth } from "@/features/auth/use-auth";
import { getAuthErrorMessage } from "@/lib/firebase-auth";
import { Button } from "@/components/ui/button";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, sendVerificationEmail, refreshVerification, logout } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"resend" | "refresh" | null>(null);

  async function handleResend() {
    setLoading("resend");
    setError(null);
    setMessage(null);
    try {
      await sendVerificationEmail();
      setMessage("A fresh verification email is on its way.");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(null);
    }
  }

  async function handleRefresh() {
    setLoading("refresh");
    setError(null);
    setMessage(null);
    try {
      const refreshedUser = await refreshVerification();
      if (refreshedUser?.emailVerified) {
        navigate("/dashboard", { replace: true });
      } else {
        setMessage("We do not see a verified email yet. Open the link in your inbox, then check again.");
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(null);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <AuthLayout>
      <AuthHeader eyebrow="One more step" title="Verify your email" description="Your account is ready. Verify your email to keep your Sejora workspace secure." />
      <div className="space-y-5">
        {message && <AuthAlert>{message}</AuthAlert>}
        {error && <AuthAlert>{error}</AuthAlert>}
        <div className="auth-detail-card rounded-xl border px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Verification email sent to</p>
          <p className="mt-2 break-all text-sm font-semibold text-ink-900">{user?.email}</p>
        </div>
        <AuthSubmitButton type="button" loading={loading === "refresh"} onClick={handleRefresh}>I’ve verified my email — Check again</AuthSubmitButton>
        <Button type="button" variant="secondary" className="w-full justify-center" disabled={loading !== null} onClick={handleResend}>
          {loading === "resend" ? "Sending…" : "Resend verification email"}
        </Button>
        <button type="button" className="auth-link block w-full text-center text-sm font-semibold" onClick={handleLogout}>Sign out</button>
      </div>
    </AuthLayout>
  );
}