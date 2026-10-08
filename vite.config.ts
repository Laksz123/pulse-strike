import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * A build for hosts that serve the game from a folder of their own (`vite build --mode idos`): the
 * art is asked for by paths that start at the site's root, and there they have to start at the page.
 */
const artFromHere: Plugin = {
  name: "art-from-here",
  enforce: "pre",
  transform(code, id) {
    if (!/\/src\/.*\.tsx?$/.test(id) || !code.includes("/art/")) return null;
    return code.replace(/(["'`])\/art\//g, "$1./art/");
  },
};

export default defineConfig(({ mode }) => ({
  base: mode === "idos" ? "./" : "/",
  plugins: mode === "idos" ? [artFromHere, react()] : [react()],
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
}));
