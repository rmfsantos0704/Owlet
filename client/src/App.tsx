import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Layout from "./components/Layout";
import LoadingScreen from "./components/shared/LoadingScreen";
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
import CollectionSettings from "./pages/CollectionSettings";
import JoinCollection from "./pages/JoinCollection";
import AiWorkspace from "./pages/AiWorkspace";
import Highlights from "./pages/Highlights";
import Comments from "./pages/Comments";
import LiteratureMatrix from "./pages/LiteratureMatrix";
import HelpSupport from "./pages/HelpSupport";
import AboutPage from "./pages/AboutPage";
import ExtensionPage from "./pages/ExtensionPage";
import { DialogProvider } from "./context/DialogContext";
import PdfReader from "./pages/PdfReader";

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

  const guest = (page: ReactElement) => (user ? <Navigate to={peekReturnTo()} replace /> : page);

  // ThemeProvider wraps everything (including the PDF reader, which sits outside <Layout />),
  // so the dark class on <html> is managed in one place. Don't mount it again inside Layout or main.tsx.
  return (
    <ThemeProvider>
      {loading ? (
        <LoadingScreen label="Loading Owlet…" />
      ) : (
        <DialogProvider>
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
            <Route path="/about" element={<AboutPage />} />
            <Route path="/extension" element={<ExtensionPage />} />

            {/* the PDF reader needs a login, but sits outside <Layout /> so it can use the whole window */}
            <Route path="/item/:id/pdf" element={user ? <PdfReader /> : <ToLogin />} />

            <Route element={user ? <Layout /> : <ToLogin />}>
              <Route path="/" element={<Library />} />
              <Route path="/all" element={<Library all />} />
              <Route path="/ai" element={<AiWorkspace />} />
              <Route path="/highlights" element={<Highlights />} />
              <Route path="/comments" element={<Comments />} />
              <Route path="/matrix" element={<LiteratureMatrix />} />
              <Route path="/help" element={<HelpSupport />} />
              <Route path="/item/:id" element={<ItemDetail />} />
              <Route path="/Collection/:id/settings" element={<CollectionSettings />} />
              <Route path="/join/:token" element={<JoinCollection />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Routes>
        </DialogProvider>
      )}
    </ThemeProvider>
  );
}