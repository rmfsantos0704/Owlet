import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { CollectionProvider } from "./context/CollectionContext";
import { wakeServer } from "./services/api";

wakeServer(); // free hosts sleep when idle: start waking the server before anyone clicks anything

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CollectionProvider>
          <App />
        </CollectionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);