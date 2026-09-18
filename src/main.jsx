import { storage } from "./storage-adapter";
window.storage = storage;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AuthGate from "./AuthGate";
import App from "./mi-agenda";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate><App /></AuthGate>
  </StrictMode>,
);
