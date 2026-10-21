import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import researchRoutes from "./routes/researchRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "2mb" }));

const minutes = (n: number) => n * 60 * 1000;
app.use("/api/auth", rateLimit({ windowMs: minutes(15), limit: 100 })); // everything under /api/auth
app.use("/api/auth/login", rateLimit({ windowMs: minutes(15), limit: 20 }));
app.use("/api/auth/register", rateLimit({ windowMs: minutes(60), limit: 10 }));
app.use(["/api/auth/forgot-password", "/api/auth/resend-verification"], rateLimit({ windowMs: minutes(15), limit: 5 }));
app.use(["/api/auth/verify-email", "/api/auth/reset-password"], rateLimit({ windowMs: minutes(15), limit: 20 }));
app.use("/api/research/clip", rateLimit({ windowMs: minutes(1), limit: 10 }));
app.use("/api/research/import", rateLimit({ windowMs: minutes(1), limit: 15 }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/workspaces", workspaceRoutes);

app.use(errorHandler);

export default app;