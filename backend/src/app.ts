import express from "express";
import session from 'express-session';
import type { Express } from "express";
import cors from "cors";

export const app: Express = express();
const PORT: number = 8080;
const sessionName = "doctor-management";

const ACCESS_CLIENT_URL: string = process.env.CLIENT_URL;
app.use(express.json())
app.use(cors({
    origin: ACCESS_CLIENT_URL,
    optionsSuccessStatus: 200,
    credentials: true,
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
        'Access-Control-Allow-Origin'
    ]
}))

// プリフライトリクエストの処理
app.options('*', cors()); // これがあれば、すべてのOPTIONSリクエストに対応

app.use(session({
    secret: process.env.DOCTOR_SESSION_SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    name: sessionName,
}))


if (process.env.NODE_ENV === "production") {
    app.set('trust proxy', 1) // trust first proxy
}

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log("server is running"));
}
