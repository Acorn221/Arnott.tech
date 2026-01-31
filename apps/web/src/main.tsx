import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { TRPCProvider } from "@/lib/TRPCProvider";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  </React.StrictMode>,
);
