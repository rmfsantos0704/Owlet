# Google Docs export setup

1. In Google Cloud Console, select or create a project and enable the **Google Docs API**.
2. Configure the OAuth consent screen. While the app is in testing, add the Google account you will use as a test user.
3. Create an OAuth client ID for a **Web application**. Add the exact Owlet dashboard origins under **Authorized JavaScript origins** (for example, `http://localhost:5173` for local development and `https://your-dashboard.example` for production).
4. Set `VITE_GOOGLE_CLIENT_ID` to that client ID in `client/.env` for local development and in the dashboard's build/deployment environment for production. The client ID is public; do not put a client secret in the frontend.
5. Restart the Vite dev server or rebuild/redeploy the dashboard after setting the variable.

The export requests Google's `drive.file` permission, a non-sensitive per-file scope that lets Owlet create and update the Google Docs it creates. It does not send the Google access token to Owlet's server. Google requires basic OAuth app verification for broader availability beyond configured test users.
