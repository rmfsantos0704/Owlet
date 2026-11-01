# Owlet API on Vercel

## Create the Vercel project

1. Import this repository as a separate Vercel project for the API.
2. Set **Root Directory** to `server`.
3. Use the detected Express framework and Node.js settings. Vercel detects the default Express export in `src/app.ts`; `vercel.json` installs development dependencies for the TypeScript build.
4. Add the environment variables below in **Project Settings > Environment Variables**. Add them to Production (and Preview if needed), then redeploy after changing them.

## Required environment variables

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | MongoDB Atlas connection URI. |
| `JWT_SECRET` | A randomly generated secret with at least 32 characters. |
| `CLIENT_URL` | The dashboard's exact HTTPS origin, with no path. |
| `TRUST_PROXY` | `1` |
| `SMTP_HOST` | SMTP server hostname. |
| `SMTP_USER` | SMTP username. |
| `SMTP_PASS` | SMTP password or provider app password. |
| `MAIL_FROM` | Verified sender address/name for the SMTP provider. |
| `SUPPORT_EMAIL` | Address that receives support requests. |

`AI_ENABLED` defaults to off. To enable AI, set it to `true` and provide `GROQ_API_KEY`; `GROQ_MODEL` is optional. `EXTRA_ORIGINS` is an optional comma-separated list of additional exact HTTPS origins.

In MongoDB Atlas, configure a database user with only the permissions the app needs. Atlas must allow connections from Vercel; Vercel's serverless functions do not have a fixed outbound IP on every plan, so review Atlas's IP access list options for your plan before deployment.

## Verify and connect the clients

After deployment, verify `https://<your-api-domain>/api/health` returns `{"ok":true}`. Set the dashboard's `VITE_API_URL` environment variable to `https://<your-api-domain>/api` and redeploy the client. The Chrome extension's `API_URL` in `extension/src/api.ts` must also use that HTTPS API URL before rebuilding and publishing the extension.
