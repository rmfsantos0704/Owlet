# Owlet API on Vercel

## Create the Vercel project

1. Import this repository as a separate Vercel project for the API.
2. Set **Root Directory** to `server`.
3. Use the detected Express framework and Node.js settings. Vercel detects the default Express export in `src/app.ts`; `vercel.json` installs development dependencies for the TypeScript build and includes PDFKit's dynamically loaded standard fonts.
4. Add the environment variables below in **Project Settings > Environment Variables**. Add them to Production (and Preview if needed), then redeploy after changing them.

## Required environment variables

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | MongoDB Atlas connection URI. |
| `JWT_SECRET` | A randomly generated secret with at least 32 characters. |
| `CLIENT_URL` | The dashboard's exact HTTPS origin, with no path. |
| `TRUST_PROXY` | `1` |
| `RESEND_API_KEY` | Resend API key. Required on Vercel because email is sent over HTTPS rather than SMTP. |
| `SMTP_HOST` | SMTP server hostname. Required with `SMTP_USER` and `SMTP_PASS` only for non-Vercel production deployments when `RESEND_API_KEY` is not set. |
| `SMTP_USER` | SMTP username (SMTP fallback only). |
| `SMTP_PASS` | SMTP password or provider app password (SMTP fallback only). |
| `MAIL_FROM` | Verified sender address/name for the selected email provider. |
| `SUPPORT_EMAIL` | Address that receives support requests. |

`AI_ENABLED` defaults to off. To enable the managed provider pool, set it to `true` and configure one or more providers. Requests try providers in this order:

| Variable | Value |
| --- | --- |
| `GROQ_API_KEY` | Groq API key. `GROQ_MODEL` is optional; defaults to `openai/gpt-oss-20b`. |
| `GEMINI_API_KEY` | Optional Google AI Studio API key. |
| `GEMINI_MODEL` | Gemini model ID; required when `GEMINI_API_KEY` is set. Use a model available on your account's free tier. |
| `OPENROUTER_API_KEY` | Optional OpenRouter API key. |
| `OPENROUTER_MODEL` | OpenRouter model ID ending in `:free`; required when `OPENROUTER_API_KEY` is set. |

`AI_USER_DAILY_LIMIT` optionally sets the maximum AI generations per account per UTC day; it defaults to `2`. Each summary, regeneration, test, or AI workspace request counts as one generation, regardless of provider token usage. The dashboard and extension popup show each account's daily usage. When an account reaches its limit, its AI-only interface switches off until the next UTC day; clips and non-AI research features remain available. This per-account allowance is stored in MongoDB and is independent between users.

Keep provider keys in the API server's environment settings, never in the dashboard or extension. If a configured provider returns an error, times out, or returns an unusable response, Owlet tries the next configured provider, up to 45 seconds total. Provider quotas are still shared by all Owlet users; the per-account allowance prevents one account from using more than its limit but cannot guarantee the providers' overall free quotas will last. No provider guarantees unlimited free usage, and free-tier terms, rate limits, models, and availability can change. A free-tier pool can avoid AI API charges only while using models and accounts actually covered by those providers' free tiers; check each provider's current terms and billing settings. Research text is sent to whichever provider handles a request, so review their data-use terms before enabling them for users. `EXTRA_ORIGINS` is an optional comma-separated list of additional exact HTTPS origins.

In MongoDB Atlas, configure a database user with only the permissions the app needs. Atlas must allow connections from Vercel; Vercel's serverless functions do not have a fixed outbound IP on every plan, so review Atlas's IP access list options for your plan before deployment.

For Vercel, configure `RESEND_API_KEY` and a `MAIL_FROM` address on a domain verified with Resend, then redeploy. SMTP connections can time out from Vercel functions, so production startup requires the Resend key there. Owlet sends registration, verification, password-reset, and support messages through Resend's HTTPS API when the key is present. SMTP remains available as a fallback for non-serverless deployments.

## Verify and connect the clients

After deployment, verify `https://<your-api-domain>/api/health` returns `{"ok":true}`. Set the dashboard's `VITE_API_URL` environment variable to `https://<your-api-domain>/api` and redeploy the client. The Chrome extension's `API_URL` in `extension/src/api.ts` must also use that HTTPS API URL before rebuilding and publishing the extension.
