import { baseUrl } from "./get-base-url";

export const buildApiEndpoint = (path: string) => {
  // In the browser, prefer relative URLs (avoid relying on NEXT_PUBLIC_BASE_URL).
  // On the server, keep absolute URLs when needed.
  if (typeof window !== "undefined") return path;
  return `${baseUrl}${path}`;
};
export const getClientIdApiPath = () => {
  return buildApiEndpoint("/api/soundcloud/get-client-id");
};

export const getDownloadApiPath = (
  trackUrl: string,
  title: string,
  clientId: string
) => {
  return buildApiEndpoint(
    `/api/soundcloud/download?url=${encodeURIComponent(
      trackUrl
    )}&title=${encodeURIComponent(title)}&client_id=${encodeURIComponent(
      clientId
    )}`
  );
};

export const getPlaylistApiPath = (playlistUrl: string) => {
  return buildApiEndpoint(
    `/api/soundcloud/playlist?url=${encodeURIComponent(playlistUrl)}`
  );
};

export const getSongAPiPath = (songUrl: string) => {
  return buildApiEndpoint(
    `/api/soundcloud/song?url=${encodeURIComponent(songUrl)}`
  );
};
