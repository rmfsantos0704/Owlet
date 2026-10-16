import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";

export async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("MongoDB connected");
}