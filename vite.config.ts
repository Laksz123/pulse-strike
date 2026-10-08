import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5183 },
  build: {
    // The engine, the physics and the Solana client change far less often than the game. Each goes in
    // a file of its own, so they download side by side and a returning player re-fetches only the game.
    chunkSizeWarningLimit: 2600,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: "physics", test: /node_modules[\\/]@dimforge/ },
            { name: "three", test: /node_modules[\\/]three/ },
            { name: "solana", test: /node_modules[\\/](@solana|@noble|bn\.js|bs58|buffer|borsh|superstruct|rpc-websockets|jayson|@babel[\\/]runtime|base-x|safe-buffer|text-encoding-utf-8|eventemitter3|uuid)/ },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/ },
          ],
        },
      },
    },
  },
});
