import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { CollectionProvider } from "./context/CollectionContext";
import { ThemeProvider } from "./context/ThemeContext";
import { wakeServer } from "./services/api";
import { initInstallPrompt, registerServiceWorker } from "./utils/pwa";

wakeServer(); // free hosts sleep when idle: start waking the server before anyone clicks anything
initInstallPrompt();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <CollectionProvider>
            <App />
          </CollectionProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);