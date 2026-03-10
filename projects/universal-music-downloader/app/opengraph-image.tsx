import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Universal Music Downloader'
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 128,
                    background: 'linear-gradient(to bottom right, #1a1a1a, #2d2d2d)',
                    color: 'white',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div style={{
                    background: 'linear-gradient(to right, #f97316, #a855f7)',
                    backgroundClip: 'text',
                    color: 'transparent',
                    fontWeight: 'bold'
                }}>
                    Universal
                </div>
                <div style={{ fontSize: 64, marginTop: 20, color: '#a1a1aa' }}>
                    Music Downloader
                </div>
            </div>
        ),
        { ...size }
    )
}
