import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const isLibrary = process.env.BUILD_MODE === "library";

export default defineConfig({
  plugins: [react()],
  ...(isLibrary
    ? {
        build: {
          lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "TreeReact",
            formats: ["es"],
            fileName: (format) => `index.js`,
          },
          rollupOptions: {
            external: ["react", "react-dom", "react/jsx-runtime"],
            output: {
              globals: {
                react: "React",
                "react-dom": "ReactDOM",
              },
            },
          },
          cssCodeSplit: false,
          sourcemap: true,
        },
        css: {
          preprocessorOptions: {
            scss: {
              api: "modern-compiler",
              silenceDeprecations: ["legacy-js-api"],
            },
          },
          modules: {
            generateScopedName: "[name]__[local]___[hash:base64:5]",
          },
        },
      }
    : {
        // Конфигурация для dev/preview (demo)
        css: {
          preprocessorOptions: {
            scss: {
              api: "modern-compiler",
              silenceDeprecations: ["legacy-js-api"],
            },
          },
        },
      }),
});