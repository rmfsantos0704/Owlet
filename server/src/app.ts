import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import researchRoutes from "./routes/researchRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Behind a host's proxy every request seems to come from the proxy, so rate limits would count everyone
// as one visitor. TRUST_PROXY = how many proxies sit in front of the server (usually 1). Unset in development.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
} else if (isProd) {
  console.warn("TRUST_PROXY is not set. Behind a host's proxy, every visitor will share one rate limit. Set it to 1.");
}

// Browsers may call the API only from the dashboard's exact origin(s). The extension is unaffected:
// extension pages with host permissions are exempt from CORS.
const allowedOrigins = [process.env.CLIENT_URL, ...(process.env.EXTRA_ORIGINS ?? "").split(",")]
  .map((o) => o?.trim().replace(/\/+$/, ""))
  .filter((o): o is string => !!o);

if (isProd && allowedOrigins.length === 0) {
  throw new Error("CLIENT_URL must be set in production, or the dashboard can't call the API.");
}

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin)); // no Origin header = not a browser page (curl, server-to-server)
    },
    maxAge: 600, // browsers may cache the preflight answer for 10 minutes
  })
);
app.use(express.json({ limit: "2mb" }));

// nothing the API returns should be stored by browsers or proxies
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const minutes = (n: number) => n * 60 * 1000;
// JSON error body so the dashboard and extension can show the message
const limiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a little and try again." },
  });

// before the limiters, so a host's health checks are never blocked
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", limiter(minutes(1), 300)); // overall cap per visitor
app.use("/api/auth", limiter(minutes(15), 100)); // everything under /api/auth
app.use("/api/auth/login", limiter(minutes(15), 20));
app.use("/api/auth/register", limiter(minutes(60), 10));
app.use(["/api/auth/forgot-password", "/api/auth/resend-verification"], limiter(minutes(15), 5));
app.use(["/api/auth/verify-email", "/api/auth/reset-password", "/api/auth/confirm-email-change"], limiter(minutes(15), 20));
app.use("/api/account", limiter(minutes(15), 100));
// these check the current password, so guessing it must be slow
app.use(["/api/account/password", "/api/account/email", "/api/account/delete"], limiter(minutes(15), 10));
app.use("/api/account/export", limiter(minutes(60), 5));
app.use("/api/research/clip", limiter(minutes(1), 10));
app.use("/api/research/import", limiter(minutes(1), 6));

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/support", limiter(minutes(15), 5)); // it sends email, so spam would cost you

// unknown API paths answer in JSON like everything else
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

app.use(errorHandler);

export default app;