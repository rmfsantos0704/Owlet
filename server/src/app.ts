import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import researchRoutes from "./routes/researchRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

// Behind a host's proxy every request seems to come from the proxy, so rate limits would count everyone
// as one visitor. TRUST_PROXY = how many proxies sit in front of the server (usually 1). Unset in development.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
}

// Browsers may call the API only from the dashboard's exact origin(s). The extension is unaffected:
// extension pages with host permissions are exempt from CORS.
const allowedOrigins = [process.env.CLIENT_URL, ...(process.env.EXTRA_ORIGINS ?? "").split(",")]
  .map((o) => o?.trim().replace(/\/+$/, ""))
  .filter((o): o is string => !!o);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin)); // no Origin header = not a browser page (curl, server-to-server)
    },
  })
);
app.use(express.json({ limit: "2mb" }));

// nothing the API returns should be stored by browsers or proxies
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const minutes = (n: number) => n * 60 * 1000;
app.use("/api/auth", rateLimit({ windowMs: minutes(15), limit: 100 })); // everything under /api/auth
app.use("/api/auth/login", rateLimit({ windowMs: minutes(15), limit: 20 }));
app.use("/api/auth/register", rateLimit({ windowMs: minutes(60), limit: 10 }));
app.use(["/api/auth/forgot-password", "/api/auth/resend-verification"], rateLimit({ windowMs: minutes(15), limit: 5 }));
app.use(["/api/auth/verify-email", "/api/auth/reset-password", "/api/auth/confirm-email-change"], rateLimit({ windowMs: minutes(15), limit: 20 }));
app.use("/api/account", rateLimit({ windowMs: minutes(15), limit: 100 }));
// these check the current password, so guessing it must be slow
app.use(["/api/account/password", "/api/account/email", "/api/account/delete"], rateLimit({ windowMs: minutes(15), limit: 10 }));
app.use("/api/account/export", rateLimit({ windowMs: minutes(60), limit: 5 }));
app.use("/api/research/clip", rateLimit({ windowMs: minutes(1), limit: 10 }));
app.use("/api/research/import", rateLimit({ windowMs: minutes(1), limit: 15 }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/workspaces", workspaceRoutes);

app.use(errorHandler);

export default app;