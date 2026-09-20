import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" keeps asset URLs relative so the build works under any
// sub-path (e.g. https://<user>.github.io/<repo>/) without configuration.
// publicDir "source" serves the CSV files as-is (dist/*.csv).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  publicDir: "source",
});
