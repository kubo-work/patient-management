import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from 'jsonwebtoken';
import { secretKey } from "./jwt_secret_key.js";
import { doctorCookieName } from "../../common/util/CookieName.js";
const { verify } = jwt;

declare module "express" {
    export interface Request {
        user?: {
            token: string;
            userId: number;
        }
    }
}

interface CustomJwtPayload extends JwtPayload {
    userId: string; // JWTのペイロードにuserIdを追加
}

export const verifyAuthToken = (request: Request, response: Response, next: NextFunction) => {
    const token = request.cookies[doctorCookieName];

    if (!token) {
        return response.status(401).json({ error: 'ログインしてください。' });
    }

    if (!secretKey) {
        response.clearCookie(doctorCookieName);
        return response.status(401).json({ error: "トークンの設定が無効です。" });
    }
    // トークンを検証
    verify(token, secretKey, (err, decoded) => {
        if (err) {
            return response.status(403).json({ error: 'ログインの有効期限が切れている可能性があります。' });
        }
        const decodedToken = decoded as CustomJwtPayload;
        request.user = { token, userId: Number(decodedToken.userId) };
        next();
    });
}
