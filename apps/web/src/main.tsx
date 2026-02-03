import "@/index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "@/App";
import { TRPCProvider } from "@/lib/TRPCProvider";
import { store } from "@/store";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode disabled - causes WebSocket reconnect loops in dev
  // <React.StrictMode>
    <Provider store={store}>
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </Provider>
  // </React.StrictMode>,
);
