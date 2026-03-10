'use client';
import React, { useState } from "react";

import { toast } from "sonner";

import { SearchResultItem } from "./types";
import { getSongAPiPath } from "@/lib/get-api-endpoint";
import { ActionInputBar } from "@/components/common";
import dictionary from "@/lib/dictionary.json";

const COMMON_DICT =
  (dictionary as unknown as { common?: Record<string, string> }).common ?? {};

interface SingleTrackTabContentProps {
  setTracks: (tracks: SearchResultItem[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  isLoading: boolean;
  isAnyLoading: boolean;
  clientId: string | null;
  hideInput?: boolean;
  externalQuery?: string;
}

export function SingleTrackTabContent({
  setTracks,
  setIsLoading,
  setError,
  isLoading,
  isAnyLoading,
  clientId,
  hideInput,
  externalQuery,
}: SingleTrackTabContentProps) {
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
    const urlToUse = (submittedUrl || url).trim();
    if (!urlToUse.trim()) {
      if (!hideInput) toast.error(t("enter_keyword"));
      return;
    }

    if (!clientId) {
      return;
    }

    setIsLoading(true);
    // setQueryParam("url", urlToUse); // Removed old param setting
    setError(null);

    try {
      const response = await fetch(getSongAPiPath(urlToUse));
      const track = await response.json();
      const newTrack: SearchResultItem = {
        id: String(track.id),
        kind: "track",
        title: track.title,
        artist: track.user.username,
        duration: track.duration / 1000,
        thumbnail: track.artwork_url,
        url: track.permalink_url,
        genre: track.genre,
        releaseDate: track.release_date,
        artworkUrl: track.artwork_url,
      };
      setTracks([newTrack]);
      if (!hideInput) toast.success(t("results_found"));
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
      label={t("sc_single_label") || "SoundCloud Track URL:"}
      placeholder={t("sc_single_placeholder") || "https://soundcloud.com/user/track-name"}
      value={url}
      onChange={setUrl}
      onSubmit={() => handleUrlSubmit()}
      disabled={isAnyLoading}
      isLoading={isLoading}
      buttonText={t("get_track") || "Get Track"}
      loadingText={t("downloading")}
    />
  );
}
