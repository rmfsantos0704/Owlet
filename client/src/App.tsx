import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
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
import EvidenceBoard from "./pages/EvidenceBoard";
import Briefs from "./pages/Briefs";
import ConceptSearch from "./pages/ConceptSearch";
import BriefView from "./pages/BriefView";
import HelpSupport from "./pages/HelpSupport";
import AboutPage from "./pages/AboutPage";
import ExtensionPage from "./pages/ExtensionPage";
import { DialogProvider } from "./context/DialogContext";
import PdfReader from "./pages/PdfReader";
import FeaturesPage from "./pages/FeaturesPage";
import ClipLink from "./pages/ClipLink";

// A join link or a "save this link" address opened while logged out: remember it, send the person to log in,
// then bring them back. Only these two kinds of address are remembered, and they are paths inside Owlet,
// so this can't be used as an open redirect.
const RETURN_KEY = "owlet.returnTo";
const JOIN_PATH = /^\/join\/[A-Za-z0-9_-]{43}$/;
const isClipPath = (path: string) => path.startsWith("/clip?") && path.length < 3200;

function peekReturnTo(): string {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    if (!raw) return "/";
    const { path, at } = JSON.parse(raw);
    return typeof path === "string" && (JOIN_PATH.test(path) || isClipPath(path)) && Date.now() - at < 30 * 60 * 1000
      ? path
      : "/";
  } catch {
    return "/";
  }
}

function ToLogin() {
  const { pathname, search } = useLocation();
  const target = pathname === "/clip" ? pathname + search : pathname;
  if (JOIN_PATH.test(pathname) || (pathname === "/clip" && isClipPath(target))) {
    try {
      localStorage.setItem(RETURN_KEY, JSON.stringify({ path: target, at: Date.now() }));
    } catch {
      /* private mode: the person just lands on the library after login */
    }
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  const guest = (page: ReactElement) => (user ? <Navigate to={peekReturnTo()} replace /> : page);

  return (
    loading ? (
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
          <Route path="/features" element={<FeaturesPage />} />
          {/* the PDF reader needs a login, but sits outside <Layout /> so it can use the whole window */}
          <Route path="/item/:id/pdf" element={user ? <PdfReader /> : <ToLogin />} />

          <Route element={user ? <Layout /> : <ToLogin />}>
            <Route path="/" element={<Library />} />
            <Route path="/all" element={<Library all />} />
            <Route path="/ai" element={<AiWorkspace />} />
            <Route path="/highlights" element={<Highlights />} />
            <Route path="/comments" element={<Comments />} />
            <Route path="/search" element={<ConceptSearch />} />
            <Route path="/help" element={<HelpSupport />} />
            <Route path="/item/:id" element={<ItemDetail />} />
            {/* save a page from its address: opened from a share link, a bookmarklet or a phone shortcut */}
            <Route path="/clip" element={<ClipLink />} />

            {/* the matrix, the evidence board and the briefs each belong to one collection, so they live under it */}
            <Route path="/Collection/:id/settings" element={<CollectionSettings />} />
            <Route path="/Collection/:id/matrix" element={<LiteratureMatrix />} />
            <Route path="/Collection/:id/board" element={<EvidenceBoard />} />
            <Route path="/Collection/:id/briefs" element={<Briefs />} />
            <Route path="/Collection/:id/briefs/:briefId" element={<BriefView />} />

            {/* the old, collection-less addresses: send people to the library, where the buttons are */}
            <Route path="/matrix" element={<Navigate to="/" replace />} />
            <Route path="/board" element={<Navigate to="/" replace />} />
            <Route path="/briefs" element={<Navigate to="/" replace />} />
            <Route path="/briefs/:id" element={<Navigate to="/" replace />} />

            <Route path="/join/:token" element={<JoinCollection />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Routes>
      </DialogProvider>
    )
  );
}