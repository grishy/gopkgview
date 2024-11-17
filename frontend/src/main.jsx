import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// StrictMode intentionally double-invokes the render function...
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
