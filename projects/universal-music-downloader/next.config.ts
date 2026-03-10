import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Next.js 15: Enable React 19 Compiler
    experimental: {
        // reactCompiler: true, // Optional: Enable if dependencies are compatible
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'i.ytimg.com' },
            { protocol: 'https', hostname: 'i1.sndcdn.com' },
            { protocol: 'https', hostname: 'i.scdn.co' },
            { protocol: 'https', hostname: 'mosaic.scdn.co' },
            { protocol: 'https', hostname: 'lineup-images.scdn.co' },
            { protocol: 'https', hostname: '**.sndcdn.com' },
        ],
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'require-corp',
                    },
                ],
            },
        ];
    },
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
    // Next.js 15: Better handling of static generation
    typescript: {
        ignoreBuildErrors: false,
    }
};

export default nextConfig;
