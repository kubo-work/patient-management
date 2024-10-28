/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: "/doctor/:path*", // APIエンドポイントに対して設定
                headers: [
                    {
                        key: "Access-Control-Allow-Origin",
                        value: process.env.NEXT_PUBLIC_API_URL, // クロスドメインで許可するドメイン
                    },
                    {
                        key: "Access-Control-Allow-Credentials",
                        value: "true", // クッキーを使用するためtrueに設定
                    },
                    {
                        key: "Access-Control-Allow-Methods",
                        value: "GET,POST,PUT,OPTIONS",
                    },
                    {
                        key: "Access-Control-Allow-Headers",
                        value: "Content-Type,Authorization",
                    },
                ],
            },
        ];
    }
}

export default nextConfig;
