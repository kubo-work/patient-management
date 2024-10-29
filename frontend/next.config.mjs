/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [
            {
                source: "/doctor/:path*",
                headers: [
                    {
                        key: "Access-Control-Allow-Origin",
                        value: process.env.NEXT_PUBLIC_API_URL,
                    },
                    {
                        key: "Access-Control-Allow-Credentials",
                        value: "true",
                    },
                    {
                        key: "Access-Control-Allow-Methods",
                        value: "GET,POST,PUT,OPTIONS",
                    },
                    {
                        key: "Access-Control-Allow-Headers",
                        value: "Content-Type,Authorization,Accept,X-Requested-With",
                    },
                ],
            },
        ];
    }
};
export default nextConfig;
