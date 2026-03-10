'use client';
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { YouTubeItem } from "./types";
import { ActionInputBar } from "@/components/common";
import dictionary from "@/lib/dictionary.json";

const COMMON_DICT =
  (dictionary as unknown as { common?: Record<string, string> }).common ?? {};

interface YouTubeSingleTrackTabContentProps {
    setItems: (items: YouTubeItem[]) => void;
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    isLoading: boolean;
    hideInput?: boolean;
    externalQuery?: string;
}

export function YouTubeSingleTrackTabContent({
    setItems,
    setIsLoading,
    setError,
    isLoading,
    hideInput,
    externalQuery,
}: YouTubeSingleTrackTabContentProps) {
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
                body: JSON.stringify({ url: urlToUse, type: "video" }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to fetch info");
            }

            const data = await res.json();
            const item: YouTubeItem = {
                id: data.id,
                title: data.title,
                thumbnail: data.thumbnail,
                duration: data.duration,
                uploader: data.uploader,
                url: data.webpage_url || urlToUse,
                kind: "video"
            };
            setItems([item]);
            if (!hideInput) toast.success(t("results_found"));

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
            label={t("yt_single_label")}
            placeholder={t("yt_single_placeholder")}
            value={url}
            onChange={setUrl}
            onSubmit={() => handleFetch()}
            disabled={isLoading}
            isLoading={isLoading}
            buttonText={t("get_track")}
            loadingText={t("searching")}
        />
    );
}
