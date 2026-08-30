import { Hono } from "hono";
import { cors } from "hono/cors";
import doctorLogin from "./doctor/login.js";
import doctorLogout from "./doctor/logout.js";
import doctorPatients from "./doctor/patients.js";
import doctorTokenCheck from "./doctor/token_check.js";
import loggedInDoctor from "./doctor/login_doctor.js";
import doctorsData from "./doctor/doctors.js";
import doctorCategories from "./doctor/categories.js";
import doctorMedicalRecords from "./doctor/medical_records.js";

// CORS の許可オリジン。未設定のまま起動すると Access-Control-Allow-Origin が
// ワイルドカードになり、credentials: true と組み合わさってブラウザ側で必ず拒否される。
// 失敗が初回リクエストまで表面化しないため、@repo/db の DATABASE_URL と同様に
// 読み込み時点で落とす。
const accessClientUrl = process.env.CLIENT_URL;
if (!accessClientUrl) {
    throw new Error(
        "CLIENT_URL が設定されていません。CORS の許可オリジンをこの環境変数から解決します。"
    );
}

// listen はここでは行わない。Node で起動する経路は index.ts、
// Vercel へ載せる経路は #287 の route handler がそれぞれ担う。
// この分離が「1 つのホストへ畳む」選択を不可逆にしないための境界になる。
export const app = new Hono()
    .use(
        "*",
        cors({
            origin: accessClientUrl,
            credentials: true,
            allowHeaders: [
                "Content-Type",
                "Authorization",
                "Accept",
                "X-Requested-With",
                "Access-Control-Allow-Credentials",
            ],
        })
    )
    .route("/doctor/login", doctorLogin)
    .route("/doctor/logout", doctorLogout)
    .route("/doctor/patients", doctorPatients)
    .route("/doctor/token_check", doctorTokenCheck)
    .route("/doctor/login_doctor", loggedInDoctor)
    .route("/doctor/doctors", doctorsData)
    .route("/doctor/categories", doctorCategories)
    .route("/doctor/medical_records", doctorMedicalRecords);
