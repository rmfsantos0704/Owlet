import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

for (const key of ["MONGODB_URI", "JWT_SECRET"]) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const port = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(port, () => console.log(`API on http://localhost:${port}`));
});