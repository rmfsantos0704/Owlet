import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await (isLogin ? login : register)(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-7">
        <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-xl bg-brand text-xl shadow-md shadow-blue-950/15">
          🦉
          <span className="absolute bottom-0 right-0 size-3.5 rounded-tl-lg bg-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLogin ? "Log in to your Owlet library." : "Start clipping and organizing research."}
          </p>
        </div>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
        <input
          type="password" required minLength={8} placeholder="Password (8+ characters)" value={password}
          onChange={(e) => setPassword(e.target.value)} className="field"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">
          {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
        </button>
        <p className="text-sm text-slate-500">
          {isLogin ? "No account? " : "Have an account? "}
          <Link to={isLogin ? "/register" : "/login"} className="font-semibold text-blue-700 hover:underline">
            {isLogin ? "Register" : "Log in"}
          </Link>
        </p>
      </form>
    </div>
  );
}