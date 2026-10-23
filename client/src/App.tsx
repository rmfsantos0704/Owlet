import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import ConfirmEmailChangePage from "./pages/auth/ConfirmEmailChangePage";
import TermsPage from "./pages/legal/TermsPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import AccountPage from "./pages/account/AccountPage";
import Library from "./pages/Library";
import ItemDetail from "./pages/ItemDetail";
import WorkspaceSettings from "./pages/WorkspaceSettings";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-gray-500">Loading…</p>;

  const guest = (page: ReactElement) => (user ? <Navigate to="/" replace /> : page);

  return (
    <Routes>
      <Route path="/login" element={guest(<LoginPage />)} />
      <Route path="/register" element={guest(<RegisterPage />)} />
      <Route path="/forgot-password" element={guest(<ForgotPasswordPage />)} />

      {/* emailed links and legal pages must work whether or not someone is logged in */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Library />} />
        <Route path="/all" element={<Library all />} />
        <Route path="/item/:id" element={<ItemDetail />} />
        <Route path="/workspace/:id/settings" element={<WorkspaceSettings />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}