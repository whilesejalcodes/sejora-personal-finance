import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createHttpServer } from "node:http";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const rootDir = isProduction
  ? path.resolve(__dirname, "../../..")
  : path.resolve(__dirname, "../..");
const port = Number(process.env.PORT ?? 5000);

const app = createApp();
const httpServer = createHttpServer(app);

if (isProduction) {
  const clientPath = path.join(rootDir, "dist/client");
  app.use(express.static(clientPath, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(clientPath, "index.html"));
  });
} else {
  const vite = await createViteServer({
    root: rootDir,
    server: {
      middlewareMode: true,
      allowedHosts: true,
      hmr: false,
      ws: false,
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Sejora is running on port ${port}`);
});