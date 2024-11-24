import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from 'jsonwebtoken';
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
    const authHeader = request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>" からトークンを取得

    if (!token) {
        return response.status(401).json({ error: 'ログインしてください。' });
    }

    // トークンを検証
    verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return response.status(403).json({ error: 'ログインの有効期限が切れている可能性があります。' });
        }
        const decodedToken = decoded as CustomJwtPayload;
        request.user = { token, userId: Number(decodedToken.userId) };
        next();
    });
}
