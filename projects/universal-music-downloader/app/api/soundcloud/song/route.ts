
import { NextRequest, NextResponse } from 'next/server';
import { getSoundCloudSong } from '@/lib/soundcloud-api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'Query parameter "url" is required' }, { status: 400 });
  }

  const url = rawUrl.trim();

  // Basic validation to prevent playlist URLs in song endpoint
  if (url.includes("/sets/")) {
    return NextResponse.json({
      error: "Detected a playlist URL. Please use the Playlist tab to download sets/playlists."
    }, { status: 400 });
  }

  try {
    const data = await getSoundCloudSong(url);
    if (!data) {
      return NextResponse.json({ error: 'Error fetching data from SoundCloud' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Error getting SoundCloud song' }, { status: 500 });
  }
}
