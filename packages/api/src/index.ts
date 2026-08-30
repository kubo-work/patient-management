import { serve } from "@hono/node-server";
import { app } from "./app.js";

// Dockerfile が PORT=8080 を渡す。未設定の環境でも従来と同じ 8080 で起動する。
const port = Number(process.env.PORT ?? 8080);

serve({ fetch: app.fetch, port }, () => console.log("server is running"));
