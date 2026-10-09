import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import VoiceAgent from "./VoiceAgent";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <VoiceAgent />
  </StrictMode>
);
