import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 静的エクスポートは Request に依存する Route Handlers と Proxy を
// サポートしない。#287 で route handler を追加したため、この構成では
// 正常にビルドできない（ADR 0006 決定 6）。
//
// 内部エラーで落ちると「意図した帰結」か「バグ」かを読み取れないため、
// ここで明示的に落とす。infra/（AWS）の扱いそのものは #293 で判断する。
if (process.env.DEPLOY_TARGET === 'aws') {
    throw new Error(
        [
            '静的エクスポート（DEPLOY_TARGET=aws）は #287 以降サポートしません。',
            'route handler（apps/web/src/app/api/[[...route]]/route.ts）と proxy.ts は',
            'output: "export" では動作しません。infra/ の扱いは #293 で判断します。',
        ].join('\n')
    );
}

// api サブドメインからのリクエストを route handler へ流すためのホスト名。
// 例: api.patient-management-kubo-works-projects.com
//
// ローカル開発では api サブドメインが存在せず、フロントは 8080 の単独起動を
// 直接叩くため未設定でよい（ADR 0006 決定 8）。Vercel では設定が必要で、
// 未設定だと api サブドメインが 404 になる。#287 のチェックリストに含めた。
const apiSubdomainHost = process.env.API_SUBDOMAIN_HOST;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    outputFileTracingRoot: path.resolve(__dirname, '../../'),
    turbopack: {},
    async rewrites() {
        if (!apiSubdomainHost) {
            return [];
        }
        // api サブドメインへの /trpc/... を /api/trpc/... へ流し、
        // route handler に拾わせる（ADR 0006 決定 1）。
        return [
            {
                source: '/:path*',
                has: [{ type: 'host', value: apiSubdomainHost }],
                destination: '/api/:path*',
            },
        ];
    },
};

export default nextConfig;
