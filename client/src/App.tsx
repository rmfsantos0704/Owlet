import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
// Change these imports:
import CollectionSettings from "./pages/CollectionSettings"; // Ensure file is CollectionSettings.tsx
import JoinCollection from "./pages/JoinCollection";       // Ensure file is JoinCollection.tsx

// A join link opened while logged out: remember it, send the person to log in, then bring them back.
// Only join links are remembered, so this can't be used as an open redirect.
const RETURN_KEY = "owlet.returnTo";
const JOIN_PATH = /^\/join\/[A-Za-z0-9_-]{43}$/;

function peekReturnTo(): string {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    if (!raw) return "/";
    const { path, at } = JSON.parse(raw);
    return typeof path === "string" && JOIN_PATH.test(path) && Date.now() - at < 30 * 60 * 1000 ? path : "/";
  } catch {
    return "/";
  }
}

function ToLogin() {
  const { pathname } = useLocation();
  if (JOIN_PATH.test(pathname)) {
    try {
      localStorage.setItem(RETURN_KEY, JSON.stringify({ path: pathname, at: Date.now() }));
    } catch {
      /* private mode: the person just lands on the library after login */
    }
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-gray-500">Loading…</p>;

  const guest = (page: ReactElement) => (user ? <Navigate to={peekReturnTo()} replace /> : page);

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

      <Route element={user ? <Layout /> : <ToLogin />}>
        <Route path="/" element={<Library />} />
        <Route path="/all" element={<Library all />} />
        <Route path="/item/:id" element={<ItemDetail />} />
<Route path="/Collection/:id/settings" element={<CollectionSettings />} />
        <Route path="/join/:token" element={<JoinCollection />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}