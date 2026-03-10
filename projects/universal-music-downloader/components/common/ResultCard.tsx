'use client';

import React from "react";
import Image from "next/image";
import {
  Check,
  Clock,
  Download,
  Loader2,
  Music,
  Pause,
  Play,
  User,
  Youtube,
} from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import dictionary from "@/lib/dictionary.json";

interface MediaItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  uploader?: string;
  artist?: string;
  duration?: number;
  kind: "track" | "video" | "playlist";
}

interface DownloadProgress {
  id: string;
  progress: number;
  status: "downloading" | "completed" | "error";
}

interface ResultCardProps {
  item: MediaItem;
  mp3QualityKbps?: 128 | 320;
  progress?: DownloadProgress;
  onDownload: (item: MediaItem) => void;
  isDownloadingAll?: boolean;
  activePreviewId?: string | null;
  onPreview?: (item: MediaItem) => void;
  source: "soundcloud" | "youtube";
}

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hrs > 0
    ? `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`
    : `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const ResultCard = React.memo(function ResultCard({
  item,
  mp3QualityKbps,
  progress,
  onDownload,
  isDownloadingAll,
  activePreviewId,
  onPreview,
  source,
}: ResultCardProps) {
  const dict = dictionary;
  const t = (key: string) => (dict as any)?.common?.[key] || key;

  const isDownloading = progress?.status === "downloading";
  const isCompleted = progress?.status === "completed";
  const isPlaying = activePreviewId === item.id;
  const canPreview = typeof onPreview === "function";

  const handlePreview = () => {
    if (!canPreview) return;
    onPreview(item);
  };

  const thumbnailContent = (
    <>
      {item.thumbnail ? (
        <Image
          src={item.thumbnail}
          alt={item.title}
          fill
          className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, 96px"
        />
      ) : (
        <div className="w-full h-full bg-foreground/5 flex items-center justify-center">
          <Music className="w-8 h-8 text-foreground/10" />
        </div>
      )}

      {canPreview && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[4px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="p-3 rounded-full bg-white text-black transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-sm shadow-black/30">
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 p-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-sm shadow-black/30">
        {source === "youtube" ? (
          <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />
        ) : (
          <Music className="w-3.5 h-3.5 text-[#FF5500]" />
        )}
      </div>
    </>
  );

  const downloadGradient =
    source === "youtube"
      ? "bg-gradient-to-r from-[#FF0000] to-[#FF5500] hover:from-[#FF5500] hover:to-[#FF0000]"
      : "bg-gradient-to-r from-[#FF5500] to-[#FF0000] hover:from-[#FF0000] hover:to-[#FF5500]";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-foreground/20 transition-all duration-300 shadow-lg shadow-black/5 dark:shadow-none overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {canPreview ? (
        <button
          type="button"
          className={cn(
            "relative w-full sm:w-24 aspect-square rounded-2xl overflow-hidden shrink-0 bg-foreground/5 shadow-sm shadow-black/30 cursor-pointer",
          )}
          onClick={handlePreview}
          aria-label={isPlaying ? "Pause preview" : "Play preview"}
          disabled={isDownloadingAll}
        >
          {thumbnailContent}
        </button>
      ) : (
        <div className="relative w-full sm:w-24 aspect-square rounded-2xl overflow-hidden shrink-0 bg-foreground/5 shadow-sm shadow-black/30">
          {thumbnailContent}
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-2 z-10">
        <h4
          className="font-semibold text-base sm:text-lg leading-snug truncate text-foreground group-hover:text-foreground/80 transition-colors"
          title={item.title}
        >
          {item.title}
        </h4>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 pr-3 py-1 rounded-full border border-white/5 bg-white/5 text-[10px] font-bold text-foreground/40 tracking-wider uppercase">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="max-w-[180px] truncate">
              {item.uploader || item.artist || t("unknown_artist")}
            </span>
          </div>

          {typeof item.duration === "number" && item.duration > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-[10px] font-bold text-foreground/25 uppercase tracking-[0.2em] border border-white/5">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(item.duration)}</span>
            </div>
          )}

          {mp3QualityKbps && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-[10px] font-bold text-foreground/25 uppercase tracking-[0.2em] border border-white/5">
              <span>MP3</span>
              <span className="tabular-nums text-foreground/35">{mp3QualityKbps}kbps</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-row sm:flex-col lg:flex-row items-center gap-2 self-end sm:self-center shrink-0 z-10 w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/10">
        {canPreview && (
          <Button
            variant="secondary"
            size="icon"
            onClick={handlePreview}
            className="h-10 w-10 rounded-xl bg-white/5 text-white border border-white/10"
            aria-label={isPlaying ? "Pause preview" : "Play preview"}
            disabled={isDownloadingAll}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </Button>
        )}

        <Button
          onClick={() => onDownload(item)}
          disabled={isDownloading || isDownloadingAll}
          className={cn(
            "h-10 px-4 rounded-xl font-bold text-sm transition-all duration-300 shadow-sm flex-1 sm:flex-none focus-visible:ring-2 focus-visible:ring-white/20",
            isCompleted
              ? "bg-white/8 text-white border border-white/15"
              : cn(
                downloadGradient,
                "text-white hover:scale-[1.02] active:scale-95"
              )
          )}
        >
          {isDownloading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-white/85" />
              <span className="tabular-nums">{progress?.progress ?? 0}%</span>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 stroke-[3px]" />
              <span>{t("downloaded") || "Downloaded"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span>Download MP3</span>
            </div>
          )}
        </Button>
      </div>

      {isDownloading && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 z-20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress?.progress ?? 0}%` }}
            className="h-full bg-gradient-to-r from-[#FF5500] to-[#FF0000]"
          />
        </div>
      )}
    </motion.div>
  );
});
