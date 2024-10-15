import express from "express";
import session from 'express-session';
import type { Express, NextFunction, Request, Response } from "express";
import { delFlag, PrismaClient } from "@prisma/client"
import cors from "cors";
import { DoctorType } from "../../common/types/DoctorType";
import { PatientType } from "../../common/types/PatientType";
import { MedicalRecordsType } from "../../common/types/MedicalRecordsType";
import { BasicCategoriesType } from "../../common/types/BasicCategoriesType";
import { MedicalRecordsCategoryType } from "../../common/types/MedicalRecordsCategoryType";
import pkg from 'pg';
import PgSession from 'connect-pg-simple';
import dayjs from "dayjs";

// SessionDataに独自の型を生やす
declare module 'express-session' {
    interface SessionData {
        sessionId?: string;
        userId?: number
    }
}

const { Pool } = pkg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

const PgSessionStore = PgSession(session)

const app: Express = express();
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
        'Cookie'  // ここにCookieを追加
    ]
}))

// プリフライトリクエストの処理
app.options('*', cors()); // これがあれば、すべてのOPTIONSリクエストに対応

app.set('trust proxy', 1) // trust first proxy
app.use(session({
    store: new PgSessionStore({
        pool,
        tableName: "session",
        createTableIfMissing: false
    }),
    secret: process.env.DOCTOR_SESSION_SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    name: sessionName,
    cookie: {
        domain: process.env.DATABASE_URL,
        secure: process.env.DOCTOR_SESSION_SECURE === "true", // HTTPSを使用
        httpOnly: false, // XSS攻撃を防ぐ
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000, // セッションの有効期限を設定（例: 24時間）
        path: "/doctor"
    }
}))

const prisma = new PrismaClient();

// ログインチェック
const doctorLoginCheck = (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.cookie) {
        return res.status(401).json({ error: "不正なアクセスです。" });
    }
    next(); // セッションがあれば次の処理に進む
};


// 患者のデータ取得
app.get("/doctor/patients/:patient_id", doctorLoginCheck
    , async (req: Request, res: Response) => {
        try {
            const { patient_id }: { patient_id: number } = req.body;
            const patient: PatientType = await prisma.patients.findFirst({
                where: {
                    id: patient_id
                }
            });
            return res.json(patient)
        } catch (e) {
            return res.status(400).json({ error: "データの取得に失敗しました。" })
        }
    })

// 患者のデータ更新
app.put("/doctor/patients/:patient_id", doctorLoginCheck
    , async (req: Request, res: Response) => {
        try {
            const { id, name, sex, tel, email, address, birth }: PatientType = req.body;
            const updated_at: Date = new Date();
            const result = await prisma.patients.update({
                where: { id },
                data: {
                    name,
                    sex,
                    tel,
                    email,
                    address,
                    birth,
                    updated_at
                },
            });
            return res.json(result)
        } catch (e) {
            return res.status(400).json({ error: "データの取得に失敗しました。" })
        }
    })


// doctor 管理画面ログイン
app.post("/doctor/login", async (req: Request, res: Response) => {
    try {
        const { email, password }: { email: string; password: string } = req.body;

        if (!email) {
            return res.status(400).json({ error: "メールアドレスが入力されていません。" })
        }

        if (!password) {
            return res.status(400).json({ error: "パスワードが入力されていません。" })
        }
        const doctor: DoctorType = await prisma.doctors.findFirst({
            where: {
                AND: [
                    { email }, { password }
                ]
            }
        })
        if (!doctor) {
            return res.status(401).json({ error: "無効なメールアドレスまたはパスワードです。" });
        }

        const sid = req.sessionID;
        req.session.sessionId = sid;
        req.session.userId = doctor.id; // 実際のデータベースIDも必要に応じて保存
        //req.session.cookie.httpOnly = true;
        return res.json({
            message: "ログインに成功しました。",
            userId: req.session.userId,
            sessionId: sid
        });
    } catch (e) {
        return res.status(400).json(e);
    }
})


// doctor ログアウト
app.post("/doctor/logout", doctorLoginCheck, async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const sid = authHeader.split(' ')[1];
        await pool.query('DELETE FROM session WHERE sid = $1', [sid]);
    }

    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.clearCookie(sessionName);  // クッキーの削除
        res.json({ message: 'ログアウトしました。' });
    });
});

// doctor session 情報を取得してログインしているユーザーの情報を取得する
app.get("/doctor/login_doctor", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "認証トークンがありません。" });
        }

        // 'Bearer 'を取り除いてセッションIDを取得
        const sid = authHeader.split(' ')[1];
        const doctorSess = await pool.query('SELECT sess FROM session WHERE sid = $1 limit 1', [sid]);
        const doctor: DoctorType = await prisma.doctors.findFirst({
            select: {
                id: true,
                name: true,
                email: true
            },
            where: {
                AND: [
                    { id: Number(doctorSess.rows[0].sess.userId) }
                ]
            }
        })
        return res.json(doctor)
    } catch (e) {
        return res.status(400).json({ error: "データの取得に失敗しました。" });
    }
});

// 医者一覧を取得
app.get("/doctor/doctors", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const allDoctors: DoctorType[] = await prisma.doctors.findMany({
            select: {
                id: true,
                name: true,
                email: true
            }
        });
        return res.json(allDoctors);
    } catch (e) {
        return res.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

// 患者一覧を取得する
app.get("/doctor/patients", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const allPatients: PatientType[] = await prisma.patients.findMany();
        return res.json(allPatients);
    } catch (e) {
        return res.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

type ResultMedicalRecordsType = Omit<MedicalRecordsType, "categories" | "delFlag"> & {
    medical_categories: {
        categories: BasicCategoriesType;
    }[]
}


// 選択した患者の診察履歴一覧を取得する
app.get("/doctor/medical_records/:patient_id", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const { patient_id }: { patient_id: number } = req.body;
        const { all, startDate, endDate } = req.query; // クエリパラメータから日付を取得

        // 現在の日付
        const now = dayjs();
        // デフォルトで3ヶ月前の日付を計算
        const threeMonthsAgo = now.subtract(3, 'month').toISOString();

        // 開始日と終了日を検証
        const validStartDate = startDate && typeof startDate === "string" ? dayjs(startDate).toISOString() : threeMonthsAgo;
        const validEndDate = endDate && typeof endDate === "string" ? dayjs(endDate).toISOString() : now.toISOString();
        const resultAllMedicalRecords: ResultMedicalRecordsType[] = await prisma.medical_records.findMany({
            select: {
                id: true,
                patient_id: true,
                examination_at: true,
                medical_memo: true,
                doctor_memo: true,
                doctor_id: true,
                medical_categories: {
                    select: {
                        categories: {
                            select: {
                                id: true,
                                treatment: true,
                            }
                        }
                    }
                }
            },
            where: {
                AND: [
                    { patient_id }, { delFlag: delFlag.ACTIVE },
                    all && typeof all === "boolean" ? {} : {
                        examination_at: {
                            gte: validStartDate,
                            lte: validEndDate,
                        }
                    }
                ]
            },
            orderBy: {
                id: "desc"
            }
        });
        const allMedicalRecords: MedicalRecordsType[] = resultAllMedicalRecords.map((result) => {
            const { id, patient_id, doctor_id, examination_at, medical_memo, doctor_memo, medical_categories } = result;
            return {
                id,
                patient_id,
                doctor_id,
                examination_at,
                medical_memo,
                doctor_memo,
                categories: medical_categories.flatMap((category) => category.categories)
            }
        })
        return res.json(allMedicalRecords);
    } catch (e) {
        return res.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

// カテゴリを取得する
app.get("/doctor/categories", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const allCategories = await prisma.categories.findMany({
            select: {
                id: true,
                treatment: true,
                children: {
                    select: {
                        id: true,
                        treatment: true
                    }
                }
            },
            where: {
                parent_id: null
            }
        });
        return res.json(allCategories);
    } catch (e) {
        return res.status(400).json({ error: "データの取得に失敗しました。" });
    }
});

type PutMedicalRecordsType = Omit<MedicalRecordsType, "categories"> & { categories: string[] }

app.put("/doctor/medical_records", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const { id, patient_id, examination_at, doctor_id, medical_memo, doctor_memo, categories }: PutMedicalRecordsType = req.body;
        const updated_at: Date = new Date();
        const medicalRecordId: number = Number(id);
        const categoryNumbers: number[] = categories.map((category) => Number(category))
        const result = await prisma.$transaction(async (prisma) => {
            await prisma.medical_records.update({
                where: { id: medicalRecordId },
                data: {
                    patient_id,
                    doctor_id,
                    medical_memo,
                    doctor_memo,
                    examination_at,
                    updated_at
                },
            });
            // 1. 現在の medical_categories を取得
            const existingCategories = await prisma.medical_categories.findMany({
                where: {
                    medical_record_id: medicalRecordId,
                },
            });

            const existingCategoryIds: number[] = existingCategories.map(cat => cat.category_id);

            // 2. 削除すべきカテゴリを特定
            const categoriesToDelete: number[] = existingCategoryIds.filter(
                categoryId => !categoryNumbers.includes(categoryId)
            );

            // 3. 追加すべきカテゴリを特定
            const categoriesToAdd: number[] = categoryNumbers.filter(
                categoryId => !existingCategoryIds.includes(categoryId)
            );

            // 4. 削除
            if (categoriesToDelete.length > 0) {
                await prisma.medical_categories.deleteMany({
                    where: {
                        medical_record_id: medicalRecordId,
                        category_id: { in: categoriesToDelete },
                    },
                });
            }

            // 5. 追加
            if (categoriesToAdd.length > 0) {
                const newMedicalCategories: MedicalRecordsCategoryType[] = categoriesToAdd.map(categoryId => ({
                    medical_record_id: medicalRecordId,
                    category_id: categoryId,
                }));

                await prisma.medical_categories.createMany({
                    data: newMedicalCategories,
                });
            }
        })
        return res.json({ data: result })
    } catch (e) {
        return res.status(400).json({ error: "データの更新に失敗しました。" });
    }
})

type PostMedicalRecordsType = PutMedicalRecordsType & { doctor_id: string };

app.post("/doctor/medical_records", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const { patient_id, doctor_id, examination_at, medical_memo, doctor_memo, categories }: PostMedicalRecordsType = req.body;
        const result = await prisma.$transaction(async (prisma) => {
            const newMedicalRecord = await prisma.medical_records.create({
                data: {
                    doctor_id,
                    patient_id,
                    medical_memo,
                    doctor_memo,
                    examination_at
                }
            });

            const medicalRecordId = newMedicalRecord.id;
            if (categories.length) {
                const postMedicalCategoriesData = categories.map((category) => (
                    {
                        medical_record_id: medicalRecordId,
                        category_id: Number(category)
                    }
                ))
                await prisma.medical_categories.createMany({
                    data: postMedicalCategoriesData
                });
            }
        })
        return res.json({ data: result })
    } catch (e) {
        return res.status(400).json({ error: "データの保存に失敗しました。" });
    }
})

app.delete("/doctor/medical_records", doctorLoginCheck, async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const result = await prisma.$transaction(async (prisma) => {
            const targetId = Number(id);
            await prisma.medical_records.update({
                data: {
                    delFlag: delFlag.DELETED
                },
                where: {
                    id: targetId
                }
            });

            await prisma.medical_categories.updateMany({
                data: {
                    delFlag: delFlag.DELETED
                },
                where: {
                    medical_record_id: targetId
                }
            });
        })
        return res.json({ data: result })
    } catch (e) {
        return res.status(400).json({ error: "データの削除に失敗しました。" });
    }
});

app.listen(PORT, () => console.log("server is running"))
