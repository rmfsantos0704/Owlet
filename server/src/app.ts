import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import researchRoutes from "./routes/researchRoutes.js";

const app = express();



app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "2mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);

app.use("/api/research/clip", rateLimit({ windowMs: 60 * 1000, limit: 10 }));
app.use("/api/research", researchRoutes);

app.use(errorHandler);

export default app;