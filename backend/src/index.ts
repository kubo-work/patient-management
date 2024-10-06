import express from "express";
import session from 'express-session';
import type { Express, NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client"
import cors from "cors";
import { DoctorType } from "../../common/types/DoctorType";
import { PatientType } from "../../common/types/PatientType";
import { MedicalRecordsType } from "../../common/types/MedicalRecordsType";
import { BasicCategoriesType } from "../../common/types/BasicCategoriesType";
import { MedicalRecordsCategoryType } from "../../common/types/MedicalRecordsCategoryType";
import { v4 as uuidv4 } from 'uuid';
// SessionDataに独自の型を生やす
declare module 'express-session' {
    interface SessionData {
        sessionId?: string;
        userId?: number
    }
}

const app: Express = express();
const PORT: number = 8080;
const sessionName = "doctor-management";

const ACCESS_CLIENT_URL: string = process.env.CLIENT_URL;
app.use(express.json())
app.use(cors({
    origin: ACCESS_CLIENT_URL,
    optionsSuccessStatus: 200,
    credentials: true
}))

app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: process.env.DOCTOR_SESSION_SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    name: sessionName,
    cookie: {
        secure: false, // HTTPSを使用
        httpOnly: true, // XSS攻撃を防ぐ
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // セッションの有効期限を設定（例: 24時間）
    }
}))

// セッションチェック用
const doctorSessionCheck = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
        return res.status(401).json({ error: "不正なアクセスです。" });
    }
    next(); // セッションがあれば次の処理に進む
};

const prisma = new PrismaClient();

// 患者のデータ取得
app.get("/patients/:patient_id", doctorSessionCheck, async (req: Request, res: Response) => {
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

        const sessionUUID = uuidv4();
        req.session.sessionId = sessionUUID;  // UUIDをセッションIDとして保存
        req.session.userId = doctor.id; // 実際のデータベースIDも必要に応じて保存
        return res.json({
            message: "ログインに成功しました。",
            sessionId: sessionUUID,
            userId: req.session.userId,
        });
    } catch (e) {
        return res.status(400).json(e);
    }
})

// doctor ログアウト
app.post("/doctor/logout", async (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.clearCookie(sessionName);  // クッキーの削除
        res.json({ message: 'ログアウトしました。' });
    });
});

// doctor session 情報を取得してログインしているユーザーの情報を取得する
app.get("/doctor/login_doctor", async (req: Request, res: Response) => {
    if (req.session.userId) {
        try {
            const doctor: DoctorType = await prisma.doctors.findFirst({
                where: {
                    AND: [
                        { id: req.session.userId }
                    ]
                }
            })
            return res.json(doctor)
        } catch (e) {
            return res.status(400).json({ error: "データの取得に失敗しました。" });
        }
    } else {
        res.status(401).json({ error: 'セッションがありません' });
    }
});

// 医者一覧を取得
app.get("/doctor/doctors", doctorSessionCheck, async (req: Request, res: Response) => {
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
app.get("/doctor/patients", doctorSessionCheck, async (req: Request, res: Response) => {
    try {
        const allPatients: PatientType[] = await prisma.patients.findMany();
        return res.json(allPatients);
    } catch (e) {
        return res.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

type ResultMedicalRecordsType = Omit<MedicalRecordsType, "categories"> & {
    medical_categories: {
        categories: BasicCategoriesType;
    }[]
}

// 選択した患者の診察履歴一覧を取得する
app.get("/doctor/medical_records/:patient_id", async (req: Request, res: Response) => {
    try {
        const { patient_id }: { patient_id: number } = req.body;
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
                                treatment: true
                            }
                        }
                    }
                }
            },
            where: {
                patient_id
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
app.get("/doctor/categories", doctorSessionCheck, async (req: Request, res: Response) => {
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

app.put("/doctor/medical_records", async (req: Request, res: Response) => {
    try {
        const { id, patient_id, doctor_id, medical_memo, doctor_memo, categories }: PutMedicalRecordsType = req.body;
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

app.post("/doctor/medical_records", async (req: Request, res: Response) => {
    try {
        const { patient_id, doctor_id, medical_memo, doctor_memo, categories }: PostMedicalRecordsType = req.body;
        const examination_at = new Date();
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
                console.log(categories)
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

app.delete("/doctor/medical_records", async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const result = await prisma.$transaction(async (prisma) => {
            const targetId = Number(id);
            await prisma.medical_records.delete({
                where: {
                    id: targetId
                }
            });

            await prisma.medical_categories.deleteMany({
                where: {
                    id: targetId
                }
            });
        })
        return res.json({ data: result })
    } catch (e) {
        return res.status(400).json({ error: "データの削除に失敗しました。" });
    }
});

app.listen(PORT, () => console.log("server is running"))
