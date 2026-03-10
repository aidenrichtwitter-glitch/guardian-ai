import "server-only";

import {
  Soundcloud,
  SoundcloudPlaylist,
  SoundcloudTrack,
} from "soundcloud.ts";
import { getSoundCloudClientId } from "@/lib/soundcloud-client-id";

const soundcloudInstance = async () => {
  const clientId = await getSoundCloudClientId();
  console.log("[soundcloudInstance] Fetched SoundCloud Client ID:", clientId);
  if (!clientId) {
    throw new Error("Client ID not found");
  }
  return new Soundcloud(clientId);
};

export const getSoundCloudSong = async (
  trackUrl: string
): Promise<SoundcloudTrack | null> => {
  const sc = await soundcloudInstance();
  try {
    const trackInfo = await sc.tracks.get(trackUrl);
    if (!trackInfo) {
      console.error(`SoundCloud song API error: ${trackInfo}`);
      return null;
    }
    return trackInfo;
  } catch (error) {
    console.error("Error getting SoundCloud song:", error);
    return null;
  }
};

export const getSoundCloudPlaylist = async (
  playlistUrl: string
): Promise<SoundcloudPlaylist | null> => {
  const sc = await soundcloudInstance();
  try {
    const playlistInfo = await sc.playlists.get(playlistUrl);
    if (!playlistInfo) {
      console.error(`SoundCloud playlist API error: ${playlistInfo}`);
      return null;
    }
    return playlistInfo;
  } catch (error) {
    console.error("Error getting SoundCloud playlist:", error);
    return null;
  }
};

export const getStreamSongUrl = async (url: string, clientId: string) => {
  try {
    const sc = await soundcloudInstance();
    const track = await sc.tracks.get(url);
    if (!track || track.kind !== "track") {
      throw new Error("URL is not a valid track");
    }

    let streamUrl: string | null = null;
    try {
      if (track.media && Array.isArray(track.media.transcodings)) {
        const progressive = track.media.transcodings.find(
          (t: any) => t.format.protocol === "progressive"
        );
        if (progressive) {
          const url = `${progressive.url}?client_id=${clientId}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            streamUrl = data.url || null;
          }
        }
      }
    } catch {
      throw new Error("No progressive stream available");
    }

    return streamUrl;
  } catch (error) {
    console.error("Error streaming SoundCloud song:", error);
    return null;
  }
};
