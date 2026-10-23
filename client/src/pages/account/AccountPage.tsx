import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import type { AccountData } from "../../types/account";
import ProfileCard from "../../components/account/ProfileCard";
import EmailCard from "../../components/account/EmailCard";
import PasswordCard from "../../components/account/PasswordCard";
import SessionsCard from "../../components/account/SessionsCard";
import DataCard from "../../components/account/DataCard";
import DeleteAccountCard from "../../components/account/DeleteAccountCard";

export default function AccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api<AccountData>("/account")
        .then(setData)
        .catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading…</p>;
  const { account, ownedWorkspaces } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Member since {new Date(account.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          {account.termsVersion ? (
            <>
              {" · "}
              <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>{" "}
              (version {account.termsVersion})
            </>
          ) : null}
        </p>
      </div>

      <ProfileCard account={account} onSaved={load} />
      <EmailCard account={account} onChanged={load} />
      <PasswordCard />
      <SessionsCard />
      <DataCard />
      <DeleteAccountCard workspaces={ownedWorkspaces} />
    </div>
  );
}