import { connectDB } from "./db.js";
import { getEnvironmentProblems } from "./environment.js";
import { User } from "../models/User.js";

let initialization: Promise<void> | undefined;

async function initialize() {
  const problems = getEnvironmentProblems(process.env.NODE_ENV === "production");
  if (problems.length) {
    throw new Error(`Can't start. Fix these environment variables: ${problems.join("; ")}`);
  }

  await connectDB();
  await User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
}

export function initializeApplication() {
  if (!initialization) {
    initialization = initialize();
    void initialization.catch(() => {
      initialization = undefined;
    });
  }
  return initialization;
}
