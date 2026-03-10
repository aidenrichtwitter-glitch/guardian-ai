import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import pLimit from "p-limit";
import { YouTubeItem, DownloadProgress } from "../types";
import { useFFmpeg } from "@/hooks/use-ffmpeg";
import dictionary from "@/lib/dictionary.json";

const COMMON_DICT =
  (dictionary as unknown as { common?: Record<string, string> }).common ?? {};

type Mp3QualityKbps = 128 | 320;

const getConcurrencyLimit = () => {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
        return Math.max(1, navigator.hardwareConcurrency - 1);
    }
    return 5; // Default concurrency
};

const limit = pLimit(getConcurrencyLimit());

const mimeToFileExtension = (mime: string) => {
    const lower = mime.toLowerCase();
    if (lower.includes("audio/mp4") || lower.includes("video/mp4")) return "m4a";
    if (lower.includes("audio/webm") || lower.includes("video/webm")) return "webm";
    if (lower.includes("audio/ogg") || lower.includes("application/ogg") || lower.includes("opus")) return "ogg";
    if (lower.includes("audio/mpeg")) return "mp3";
    if (lower.includes("audio/wav")) return "wav";
    if (lower.includes("audio/flac")) return "flac";
	return "bin";
};

export function useYouTubeDownloader() {
    const t = useCallback((key: string) => COMMON_DICT[key] || key, []);

    // State
    const [activeTab, setActiveTab] = useState<"single" | "playlist">("single");
    const [items, setItems] = useState<YouTubeItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress[]>([]);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewItem, setPreviewItem] = useState<YouTubeItem | null>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const { processAudio, isLoading: isFFmpegLoading } = useFFmpeg();

    const [mp3QualityKbps, setMp3QualityKbps] = useState<Mp3QualityKbps>(320);

    const isAnyLoading = isLoading || isDownloadingAll || isFFmpegLoading;

    const handleNewResults = useCallback(() => {
        if (resultsRef.current && !isLoading) {
            resultsRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, [isLoading]);

    useEffect(() => {
        if (items.length > 0) {
            handleNewResults();
        }
    }, [items.length, handleNewResults]);


    // Handlers
    const handleTabChange = useCallback((value: string) => {
        if (!isAnyLoading) {
            if (value !== "single" && value !== "playlist") return;
            setActiveTab(value);
            setItems([]);
            setError(null);
            setIsLoading(false);
            setDownloadProgress([]);
            setIsDownloadingAll(false);
            setPreviewItem(null);
        }
    }, [isAnyLoading]);

    const handleDownloadSingle = useCallback(async (item: YouTubeItem) => {
        setDownloadProgress(prev => [...prev.filter(p => p.id !== item.id), { id: item.id, progress: 0, status: "downloading" }]);
        toast.info(`${t("start_download")}: "${item.title}"`);

        try {
            // Updated API URL to include title for better fallback naming if FFmpeg fails
            // Updated API URL to use the selected format and title
            const downloadUrl = `/api/youtube/download?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}`;
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: t("error_download") }));
                throw new Error(errorData.error);
            }

            if (!response.body) {
                throw new Error(t("no_tracks_download"));
            }

            const reader = response.body.getReader();
            const contentLength = response.headers.get("Content-Length");
            const totalLength = contentLength ? parseInt(contentLength, 10) : 0;
            let receivedLength = 0;
            const chunks: Uint8Array[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                if (totalLength) {
                    const progress = Math.round((receivedLength / totalLength) * 100);
                    // Share 70% of progress for downloading, 30% for FFmpeg processing
                    setDownloadProgress(prev => prev.map(p => p.id === item.id ? { ...p, progress: Math.round(progress * 0.7) } : p));
                }
            }

            const upstreamContentType =
              response.headers.get("Content-Type") || "application/octet-stream";
            const rawExt = mimeToFileExtension(upstreamContentType);

            const mergedBytes = new Uint8Array(receivedLength);
            let offset = 0;
            for (const chunk of chunks) {
              mergedBytes.set(chunk, offset);
              offset += chunk.length;
            }

            const rawBlob = new Blob([mergedBytes], { type: upstreamContentType });

            // --- FFmpeg Client Side Processing (required) ---
            let finalBlob: Blob;
            const finalExt: string = "mp3";
            try {
                toast.info(`${t("processing_ffmpeg")}: "${item.title}"`);
                const itemMetadata = {
                    title: item.title,
                    artist: item.uploader,
                    album: "YouTube",
                } as const;

                finalBlob = await processAudio(rawBlob, {
                    ...itemMetadata,
                    format: "mp3",
                    mp3BitrateKbps: mp3QualityKbps,
                });
                setDownloadProgress(prev => prev.map(p => p.id === item.id ? { ...p, progress: 100 } : p));
            } catch (ffmpegErr) {
                console.warn("FFmpeg processing failed", ffmpegErr);
                const message =
                    ffmpegErr instanceof Error ? ffmpegErr.message : "Unknown error";
                toast.error(`FFmpeg conversion failed: "${item.title}" (${message})`);
                setDownloadProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: "error" } : p));
                return;
            }

            const blobUrl = window.URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${item.title}.${finalExt}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);

            setDownloadProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: "completed", progress: 100 } : p));
            toast.success(`${t("success_download")}: "${item.title}"`);
        } catch (err: any) {
            console.error(err);
            toast.error(`${t("error_download")}: "${item.title}" (${err.message})`);
            setDownloadProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: "error" } : p));
        }
    }, [t, processAudio, mp3QualityKbps]);

    const handleDownloadAll = useCallback(async () => {
        const videosToDownload = items.filter(i => {
            if (i.kind !== "video") return false;
            const progress = downloadProgress.find(p => p.id === i.id);
            return !progress || progress.status !== 'completed';
        });

        if (videosToDownload.length === 0) {
            toast.info(t("all_downloaded"));
            return;
        }

        setIsDownloadingAll(true);
        toast.info(t("start_download_count").replace("{count}", videosToDownload.length.toString()));

        const downloadPromises = videosToDownload.map(item =>
            limit(() => handleDownloadSingle(item))
        );

        await Promise.all(downloadPromises);

        setIsDownloadingAll(false);
        toast.success(t("all_downloaded"));
    }, [items, downloadProgress, handleDownloadSingle, t]);


    const getProgress = useCallback((id: string) => {
        return downloadProgress.find(p => p.id === id);
    }, [downloadProgress]);

    const handlePreview = useCallback((item: YouTubeItem) => {
        if (previewItem?.id === item.id) {
            setPreviewItem(null);
        } else {
            setPreviewItem(item);
        }
    }, [previewItem]);

    const handleRetry = useCallback(() => {
        setError(null);
    }, []);

    return {
        state: {
            activeTab,
            items,
            isLoading,
            downloadProgress,
            isDownloadingAll,
            error,
            previewItem,
            isAnyLoading,
            resultsRef,
            mp3QualityKbps,
        },
        actions: {
            setActiveTab: handleTabChange,
            setItems,
            setIsLoading,
            setError,
            handleDownloadSingle,
            handleDownloadAll,
            handlePreview,
            setPreviewItem,
            getProgress,
            handleRetry,
            setMp3QualityKbps,
        }
    };
}
