import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import pLimit from "p-limit";
import { useClientId } from "@/contexts/ClientIdProvider";
import { getDownloadApiPath } from "@/lib/get-api-endpoint";
import { SearchResultItem, DownloadProgress } from "../types";
import { useFFmpeg } from "@/hooks/use-ffmpeg";
import dictionary from "@/lib/dictionary.json";

const COMMON_DICT =
  (dictionary as unknown as { common?: Record<string, string> }).common ?? {};

type Mp3QualityKbps = 128 | 320;

const getConcurrencyLimit = () => {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
        return Math.max(1, navigator.hardwareConcurrency - 1);
    }
    return 5;
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

export function useSoundCloudDownloader() {
    const t = useCallback((key: string) => COMMON_DICT[key] || key, []);

    const { clientId } = useClientId();

    const { processAudio, isLoading: isFFmpegLoading } = useFFmpeg();

    // State
    const [activeTab, setActiveTab] = useState<"single" | "playlist">("single");
    const [tracks, setTracks] = useState<SearchResultItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress[]>([]);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewItem, setPreviewItem] = useState<SearchResultItem | null>(null);

    const [mp3QualityKbps, setMp3QualityKbps] = useState<Mp3QualityKbps>(320);

    const resultsRef = useRef<HTMLDivElement>(null);

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
        if (tracks.length > 0) {
            handleNewResults();
        }
    }, [tracks.length, handleNewResults]);

    // Handlers
    const handleTabChange = useCallback((value: string) => {
        if (!isAnyLoading) {
            if (value !== "single" && value !== "playlist") return;
            setActiveTab(value);
            setTracks([]);
            setError(null);
            setIsLoading(false);
            setDownloadProgress([]);
            setIsDownloadingAll(false);
            setPreviewItem(null);
        }
    }, [isAnyLoading]);

    const handleDownloadSingle = useCallback(async (item: SearchResultItem) => {
        if (item.kind !== "track") {
            toast.error("Only tracks can be downloaded.");
            return;
        }

        if (!clientId) {
            toast.error("Client ID is not available yet.");
            return;
        }

        setDownloadProgress((prev) => [
            ...prev.filter((p) => p.id !== item.id),
            { id: item.id, progress: 0, status: "downloading" },
        ]);

        toast.info(t("start_download_count").replace("{count}", item.title));

        try {
            const response = await fetch(
                getDownloadApiPath(item.url, item.title, clientId)
            );

            if (!response.ok) {
                let errMsg = `HTTP ${response.status} ${response.statusText}`;
                try {
                    const json = await response.json();
                    if (json && json.error) errMsg = json.error;
                } catch (e) {
                    // ignore
                }
                throw new Error(errMsg);
            }

            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("audio") && !contentType.includes("application/octet-stream")) {
                let bodyText = "";
                try {
                    bodyText = await response.text();
                    const maybeJson = JSON.parse(bodyText || "null");
                    if (maybeJson && maybeJson.error) throw new Error(maybeJson.error);
                } catch (e) {
                    const snippet = bodyText.substring(0, 200);
                    throw new Error(`Unexpected content-type: ${contentType}. Body: ${snippet}`);
                }
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
                    setDownloadProgress((prev) =>
                        prev.map((p) =>
                            p.id === item.id ? { ...p, progress: Math.round(progress * 0.7) } : p
                        )
                    );
                }
            }

            const upstreamContentType =
              response.headers.get("content-type") || "application/octet-stream";
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
                    artist: item.artist,
                    album: "SoundCloud",
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

            const url = window.URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            const uniqueId = `download-${item.id}-${Date.now()}`;
            a.id = uniqueId;
            a.href = url;
            a.download = `${item.title}.${finalExt}`;
            document.body.appendChild(a);
            a.click();

            const el = document.getElementById(uniqueId);
            if (el && el.parentElement) el.parentElement.removeChild(el);
            window.URL.revokeObjectURL(url);

            setDownloadProgress((prev) =>
                prev.map((p) =>
                    p.id === item.id ? { ...p, progress: 100, status: "completed" } : p
                )
            );
            toast.success(`${t("success_download")}: "${item.title}"`);
        } catch (error: any) {
            console.error(error);
            toast.error(`${t("error_download")}: "${item.title}"`);
            setDownloadProgress((prev) =>
                prev.map((p) =>
                    p.id === item.id ? { ...p, status: "error" } : p
                )
            );
        }
    }, [clientId, t, processAudio, mp3QualityKbps]);

    const handleDownloadAll = useCallback(async () => {
        if (tracks.length === 0) {
            toast.error(t("no_tracks_download"));
            return;
        }

        setIsDownloadingAll(true);

        const tracksToDownload = tracks.filter((item) => {
            if (item.kind !== "track") return false;
            const progress = downloadProgress.find(p => p.id === item.id);
            return progress?.status !== 'completed';
        });

        if (tracksToDownload.length === 0) {
            toast.info(t("all_downloaded"));
            setIsDownloadingAll(false);
            return;
        }

        toast.info(t("start_download_count").replace("{count}", tracksToDownload.length.toString()));

        const downloadPromises = tracksToDownload
            .map((item) => limit(() => handleDownloadSingle(item)));

        await Promise.all(downloadPromises);

        setIsDownloadingAll(false);
        toast.success(t("all_downloaded"));
    }, [tracks, handleDownloadSingle, downloadProgress, t]);

    const getProgressForTrack = useCallback((id: string) => {
        return downloadProgress.find((p) => p.id === id);
    }, [downloadProgress]);

    const handlePreview = useCallback((item: SearchResultItem) => {
        if (!clientId) {
            toast.error(t("client_id_missing"));
            return;
        }
        if (previewItem?.id === item.id) {
            setPreviewItem(null);
        } else {
            setPreviewItem(item);
        }
    }, [previewItem, clientId, t]);

    const handleRetry = useCallback(() => {
        setError(null);
    }, []);

    return {
        state: {
            activeTab,
            tracks,
            isLoading,
            downloadProgress,
            isDownloadingAll,
            error,
            previewItem,
            isAnyLoading,
            clientId,
            resultsRef,
            mp3QualityKbps,
        },
        actions: {
            setActiveTab: handleTabChange,
            setTracks,
            setIsLoading,
            setError,
            handleDownloadSingle,
            handleDownloadAll,
            handlePreview,
            setPreviewItem,
            getProgressForTrack,
            handleRetry,
            setMp3QualityKbps,
        }
    };
}
