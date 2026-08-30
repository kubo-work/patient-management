import { Hono } from "hono";
import { requireDoctor, type DoctorAuthVariables } from "../middleware/requireDoctor.js";

const router = new Hono<{ Variables: DoctorAuthVariables }>();

router.get("/", requireDoctor, (context) => {
    return context.json([{ success: "認証に成功しました。" }]);
});

export default router;
