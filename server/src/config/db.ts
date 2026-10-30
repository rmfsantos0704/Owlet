import dns from "node:dns";
import mongoose from "mongoose";
import { ResearchItem } from "../models/ResearchItem.js";
import { collection } from "../models/Collection.js";

// Development workaround: some home networks fail the DNS lookup behind mongodb+srv:// addresses.
// Never in production, where it would bypass the host's own DNS.
if (process.env.NODE_ENV !== "production") dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function connectDB() {
  mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));

  await mongoose.connect(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 10_000, // fail fast with a clear error instead of hanging
    maxPoolSize: 10,
  });
  console.log("MongoDB connected");
  await Promise.all([ResearchItem.syncIndexes(), collection.syncIndexes()]);
}