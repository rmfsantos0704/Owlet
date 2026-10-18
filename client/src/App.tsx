import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import Library from "./pages/Library";
import ItemDetail from "./pages/ItemDetail";
import WorkspaceSettings from "./pages/WorkspaceSettings";
export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-gray-500">Loading…</p>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/workspace/:id/settings" element={<WorkspaceSettings />} />
        <Route path="/" element={<Library />} />
        <Route path="/item/:id" element={<ItemDetail />} />
      </Route>
    </Routes>
  );
}