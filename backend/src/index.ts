import express from "express";
import session from 'express-session';
import type { Express } from "express";
import cors from "cors";
import doctorLogin from "./doctor/login.js";
import doctorLogout from "./doctor/logout.js";
import doctorPatients from "./doctor/patients.js";
import doctorTokenCheck from "./doctor/token_check.js";
import loggedInDoctor from "./doctor/login_doctor.js";
import doctorsData from "./doctor/doctors.js";
import doctorCategories from "./doctor/categories.js";
import doctorMedicalRecords from "./doctor/medical_records.js";
import cookieParser from "cookie-parser";

// // SessionDataに独自の型を生やす
declare module 'express-session' {
    interface SessionData {
        sessionId?: string;
        userId?: number
    }
}

export const app: Express = express();
const PORT: number = 8080;
export const sessionName = "doctor-management";

const ACCESS_CLIENT_URL: string | undefined = process.env.CLIENT_URL;
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


app.use(cookieParser());

if (process.env.NODE_ENV === "production") {
    app.set('trust proxy', 1) // trust first proxy
}

app.use("/doctor/login", doctorLogin);
app.use("/doctor/logout", doctorLogout);
app.use("/doctor/patients", doctorPatients);
app.use("/doctor/token_check", doctorTokenCheck);
app.use("/doctor/login_doctor", loggedInDoctor);
app.use("/doctor/doctors", doctorsData);
app.use("/doctor/categories", doctorCategories);
app.use("/doctor/medical_records", doctorMedicalRecords);

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log("server is running"));
}
