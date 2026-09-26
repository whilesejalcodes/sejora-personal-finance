import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";

export function AuthLoadingScreen() {
  return (
    <main className="auth-shell flex min-h-[100svh] items-center justify-center px-6">
      <div className="text-center">
        <div className="logo-mark mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white">
          <span className="text-lg font-semibold">S</span>
        </div>
        <p className="mt-5 text-sm font-semibold text-ink-700">Checking your secure session…</p>
      </div>
    </main>
  );
}

export function PublicOnlyRoute() {
  const { loading, user, isEmailVerified } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoadingScreen />;
  }
  if (user) {
    return <Navigate to={isEmailVerified ? "/dashboard" : "/verify-email"} state={{ from: location }} replace />;
  }
  return <Outlet />;
}

export function VerifiedRoute() {
  const { loading, user, isEmailVerified } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  return <Outlet />;
}

export function VerificationRoute() {
  const { loading, user, isEmailVerified } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (isEmailVerified) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}