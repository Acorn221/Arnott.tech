import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { TRPCProvider } from "@/lib/TRPCProvider";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode disabled - causes WebSocket reconnect loops in dev
  // <React.StrictMode>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  // </React.StrictMode>,
);
