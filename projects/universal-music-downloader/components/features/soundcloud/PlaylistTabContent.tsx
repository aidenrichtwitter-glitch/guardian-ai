'use client';
import React, { useState } from "react";

import { toast } from "sonner";

import { SearchResultItem } from "./types";
import { getPlaylistApiPath } from "@/lib/get-api-endpoint";
import { ActionInputBar } from "@/components/common";
import dictionary from "@/lib/dictionary.json";

const COMMON_DICT =
  (dictionary as unknown as { common?: Record<string, string> }).common ?? {};

interface PlaylistTabContentProps {
  setTracks: (tracks: SearchResultItem[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  isLoading: boolean;
  isAnyLoading: boolean;
  clientId: string | null;
  hideInput?: boolean;
  externalQuery?: string;
}

export function PlaylistTabContent({
  setTracks,
  setIsLoading,
  setError,
  isLoading,
  isAnyLoading,
  clientId,
  hideInput,
  externalQuery,
}: PlaylistTabContentProps) {
  const t = React.useCallback((key: string) => COMMON_DICT[key] || key, []);
  const [url, setUrl] = useState("");
  const lastFetchedUrlRef = React.useRef<string>("");

  // Sync external query
  React.useEffect(() => {
    if (typeof externalQuery === 'string') {
      setUrl(externalQuery);
    }
  }, [externalQuery]);

  const handleUrlSubmit = React.useCallback(async (submittedUrl?: string) => {
    const urlToUse = submittedUrl || url;
    if (!urlToUse.trim()) {
      if (!hideInput) toast.error(t("enter_keyword"));
      return;
    }

    if (!clientId) {
      setError(t("client_id_missing"));
      if (!hideInput) toast.error(t("client_id_missing"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        getPlaylistApiPath(urlToUse)
      );
      const data = await response.json();
      const newResults: SearchResultItem[] = data.tracks.map((track: any) => ({
        id: String(track.id),
        kind: "track",
        title: track.title,
        artist: track.user.username,
        duration: Math.round((track.duration || 0) / 1000),
        thumbnail: track.artwork_url,
        url: track.permalink_url,
      }));
      setTracks(newResults);
      if (!hideInput) toast.success(`${t("results_found")}: ${newResults.length}`);
    } catch (error) {
      setError(t("error_download"));
      if (!hideInput) toast.error(t("error_download"));
    } finally {
      setIsLoading(false);
    }
  }, [url, hideInput, t, clientId, setIsLoading, setError, setTracks]);

  React.useEffect(() => {
    if (!hideInput) return;
    const urlToUse = externalQuery?.trim();
    if (!urlToUse || !clientId) return;
    if (urlToUse === lastFetchedUrlRef.current) return;
    lastFetchedUrlRef.current = urlToUse;
    handleUrlSubmit(urlToUse);
  }, [hideInput, externalQuery, clientId, handleUrlSubmit]);

  if (hideInput) return null;

  return (
    <ActionInputBar
      label={t("sc_playlist_label") || "SoundCloud Playlist URL:"}
      placeholder={t("sc_playlist_placeholder") || "https://soundcloud.com/user/sets/playlist-name"}
      value={url}
      onChange={setUrl}
      onSubmit={() => handleUrlSubmit()}
      disabled={isAnyLoading}
      isLoading={isLoading}
      buttonText={t("get_playlist") || "Get Playlist"}
      loadingText={t("downloading")}
    />
  );
}
