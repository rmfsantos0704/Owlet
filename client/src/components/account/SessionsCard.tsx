import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { useAction } from "../../hooks/useAction";
import { setLoginNotice } from "../../utils/notice";
import SectionCard, { Note } from "./SectionCard";

export default function SessionsCard() {
  const { logout } = useAuth();
  const action = useAction();

  async function signOutEverywhere() {
    if (!confirm("Sign out of Owlet on every device, including this one?")) return;
    const ok = await action.run(async () => {
      await api("/account/sign-out-everywhere", { method: "POST" });
    });
    if (ok) {
      setLoginNotice("You were signed out of all devices. Log in again to continue.");
      logout();
    }
  }

  return (
    <SectionCard
      title="Sessions"
      description="Lost a phone or used a shared computer? End every active login, including this one, and log in again."
    >
      {action.error ? <div className="mb-3"><Note kind="error">{action.error}</Note></div> : null}
      <button onClick={signOutEverywhere} disabled={action.busy} className="btn-secondary">
        Sign out everywhere
      </button>
    </SectionCard>
  );
}