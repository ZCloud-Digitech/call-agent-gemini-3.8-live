import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import VoiceAgent from "./VoiceAgent";
import Admin from "./Admin";
import "./styles.css";

// /admin -> staff dashboard, matha ellam -> voice agent
const isAdmin = window.location.pathname.startsWith("/admin");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <VoiceAgent />}
  </StrictMode>
);
