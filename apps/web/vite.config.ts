import react from "@vitejs/plugin-react";
import * as path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
  define: {
    _global: {},
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js and 3D rendering (largest)
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          // React core
          react: ["react", "react-dom", "react-router-dom"],
          // Redux state management
          redux: ["@reduxjs/toolkit", "react-redux"],
        },
      },
    },
  },
});
