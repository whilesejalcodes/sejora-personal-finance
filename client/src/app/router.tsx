import { CreditCard, FileScan, Goal } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { AnalyticsPage } from "@/features/analytics/analytics-page";
import { ForecastPage } from "@/features/forecast/forecast-page";
import { InsightsPage } from "@/features/insights/insights-page";
import { RecurringPaymentsPage } from "@/features/recurring/recurring-payments-page";
import { GoalsPage } from "@/features/goals/goals-page";
import { UpcomingCashFlowPage } from "@/features/cash-flow/upcoming-cash-flow-page";
import { TransactionsPage } from "@/features/transactions/transactions-page";
import { BudgetsPage } from "@/features/budgets/budgets-page";
import { ForgotPasswordPage } from "@/features/auth/forgot-password-page";
import { LoginPage } from "@/features/auth/login-page";
import { PublicOnlyRoute, VerificationRoute, VerifiedRoute } from "@/features/auth/auth-route-guards";
import { SignupPage } from "@/features/auth/signup-page";
import { VerifyEmailPage } from "@/features/auth/verify-email-page";
import { ReceiptScannerPage } from "@/features/receipts/receipt-scanner-page";
import { AiFinancePage } from "@/features/ai-finance/ai-finance-page";
import { SettingsPage } from "@/features/settings/settings-page";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route element={<VerificationRoute />}>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>
      <Route element={<VerifiedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/cash-flow" element={<UpcomingCashFlowPage />} />
          <Route path="/recurring-payments" element={<RecurringPaymentsPage />} />
          <Route path="/receipts" element={<ReceiptScannerPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/ai-finance" element={<AiFinancePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}