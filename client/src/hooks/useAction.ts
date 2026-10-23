import { useState } from "react";

// Runs an async action and tracks "working", the error message, and a success message.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const message = await fn();
      if (message) setDone(message);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, done, run, fail: setError };
}