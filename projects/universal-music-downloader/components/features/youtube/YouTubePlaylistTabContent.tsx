'use client';
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { YouTubeItem } from "./types";
import { ActionInputBar } from "@/components/common";
import dictionary from "@/lib/dictionary.json";

const COMMON_DICT =
  (dictionary as unknown as { common?: Record<string, string> }).common ?? {};

interface YouTubePlaylistTabContentProps {
    setItems: (items: YouTubeItem[]) => void;
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    isLoading: boolean;
    hideInput?: boolean;
    externalQuery?: string;
}

export function YouTubePlaylistTabContent({
    setItems,
    setIsLoading,
    setError,
    isLoading,
    hideInput,
    externalQuery,
}: YouTubePlaylistTabContentProps) {
    const t = React.useCallback((key: string) => COMMON_DICT[key] || key, []);
    const [url, setUrl] = useState("");
    const lastFetchedUrlRef = React.useRef("");

    // Sync external query
    useEffect(() => {
        if (typeof externalQuery === 'string') {
            setUrl(externalQuery);
        }
    }, [externalQuery]);

    const handleFetch = React.useCallback(async (overrideUrl?: string) => {
        const urlToUse = (overrideUrl || url || "").trim();

        if (!urlToUse) {
            if (!hideInput) toast.error(t("enter_keyword"));
            return;
        }

        setIsLoading(true);
        setError(null);
        setItems([]);

        try {
            const res = await fetch("/api/youtube/info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: urlToUse, type: "playlist" }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to fetch playlist");
	            }
	
	            const data = await res.json();
	            const entries = Array.isArray(data.entries) ? data.entries : [];
	            const mappedItems: YouTubeItem[] = entries
	                .filter((entry: any) => {
	                    const title = typeof entry?.title === "string" ? entry.title.trim() : "";
	                    const availability =
	                        typeof entry?.availability === "string"
	                            ? entry.availability.toLowerCase()
	                            : "";
	                    if (!entry?.id || !title) return false;
	                    if (
	                        /^\[(private|deleted|unavailable) video\]$/i.test(title) ||
	                        /^(private|deleted|unavailable) video$/i.test(title)
	                    ) {
	                        return false;
	                    }
	                    if (
	                        availability &&
	                        (availability.includes("private") ||
	                            availability.includes("deleted") ||
	                            availability.includes("unavailable"))
	                    ) {
	                        return false;
	                    }
	                    return true;
	                })
	                .map((entry: any) => ({
	                    id: entry.id,
	                    title: entry.title,
	                    thumbnail: entry.thumbnails?.[0]?.url || "",
	                    duration: entry.duration,
	                    uploader: entry.uploader,
	                    url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
	                    kind: "video",
	                }));

            setItems(mappedItems);
            if (!hideInput) toast.success(`${t("results_found")}: ${mappedItems.length}`);


        } catch (err: any) {
            console.error(err);
            setError(err.message || t("error"));
            if (!hideInput) toast.error(t("error"));
        } finally {
            setIsLoading(false);
        }
    }, [url, hideInput, t, setError, setIsLoading, setItems]);

    useEffect(() => {
        if (!hideInput) return;
        const urlToUse = externalQuery?.trim();
        if (!urlToUse) return;
        if (urlToUse === lastFetchedUrlRef.current) return;
        lastFetchedUrlRef.current = urlToUse;
        void handleFetch(urlToUse);
    }, [hideInput, externalQuery, handleFetch]);

    if (hideInput) return null;

    return (
        <ActionInputBar
            label={t("yt_playlist_label")}
            placeholder={t("yt_playlist_placeholder")}
            value={url}
            onChange={setUrl}
            onSubmit={() => handleFetch()}
            disabled={isLoading}
            isLoading={isLoading}
            buttonText={t("get_playlist")}
            loadingText={t("searching")}
        />
    );
}
