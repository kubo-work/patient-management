/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: "/doctor/:path*", // /doctor配下に限定
                headers: [
                    {
                        key: "Access-Control-Allow-Origin",
                        value: process.env.CLIENT_URL || "https://your-allowed-domain.com", // 環境変数でドメインを管理
                    },
                    {
                        key: "Access-Control-Allow-Credentials",
                        value: "true", // クッキーを有効にする
                    },
                    {
                        key: "Access-Control-Allow-Methods",
                        value: "GET,POST,PUT,OPTIONS", // PUTを追加
                    },
                    {
                        key: "Access-Control-Allow-Headers",
                        value: "Content-Type,Authorization,Accept,X-Requested-With", // 必要なヘッダーのみ許可
                    },
                ],
            },
        ];
    }
};

export default nextConfig;
