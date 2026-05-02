import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** @type {import('next').NextConfig} */
const isAwsDeploy = process.env.DEPLOY_TARGET === 'aws';

const nextConfig = {
    reactStrictMode: true,
    outputFileTracingRoot: path.resolve(__dirname, '../'),
    ...(isAwsDeploy
        ? {
              output: 'export',
              trailingSlash: true,
          }
        : {
              turbopack: {},
              async headers() {
                  return [
                      {
                          source: "/doctor/:path*",
                          headers: [
                              {
                                  key: "Access-Control-Allow-Origin",
                                  value: process.env.NEXT_PUBLIC_FRONT_URL,
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
              },
          }),
};
export default nextConfig;
