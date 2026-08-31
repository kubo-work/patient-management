import { router } from "./init.js";
import { categoriesRouter } from "../router/categories.js";
import { doctorsRouter, loginDoctorProcedure } from "../router/doctors.js";
import { patientsRouter } from "../router/patients.js";
import { medicalRecordsRouter } from "../router/medicalRecords.js";
import { loginProcedure, logoutProcedure } from "../router/auth.js";

// doctor 名前空間を保つのは、患者向けの API を将来足す余地を残すため。
// 移植前の REST も /doctor/* だった。
export const appRouter = router({
    doctor: router({
        categories: categoriesRouter,
        doctors: doctorsRouter,
        loginDoctor: loginDoctorProcedure,
        login: loginProcedure,
        logout: logoutProcedure,
        patients: patientsRouter,
        medicalRecords: medicalRecordsRouter,
    }),
});

export type AppRouter = typeof appRouter;
