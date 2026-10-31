// AI features are off unless AI_ENABLED=true. It is read when called, so it doesn't matter when .env is loaded.
export const aiEnabled = () => process.env.AI_ENABLED === "true";