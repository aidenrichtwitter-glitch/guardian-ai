import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DownloadCloud, Loader2 } from "lucide-react";
import dictionary from "@/lib/dictionary.json";
import { ResultCard } from "@/components/common/ResultCard";
import { SearchResultItem, DownloadProgress } from "../types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface SoundCloudResultsProps {
  tracks: SearchResultItem[];
  isDownloadingAll: boolean;
  isAnyLoading: boolean;
  mp3QualityKbps: 128 | 320;
  onMp3QualityKbpsChange: (v: 128 | 320) => void;
  onDownloadAll: () => void;
  onDownloadSingle: (item: SearchResultItem) => void;
  getProgress: (id: string) => DownloadProgress | undefined;
  previewItem: SearchResultItem | null;
  onPreview: (item: SearchResultItem) => void;
}

export const SoundCloudResults = React.forwardRef<
  HTMLDivElement,
  SoundCloudResultsProps
>(
  (
    {
      tracks,
      isDownloadingAll,
      isAnyLoading,
      mp3QualityKbps,
      onMp3QualityKbpsChange,
      onDownloadAll,
      onDownloadSingle,
      getProgress,
      previewItem,
      onPreview,
    },
    ref
  ) => {
    const dict = dictionary;
    const t = (key: string) => (dict as any)?.common?.[key] || key;

    if (tracks.length === 0) return null;

    const downloadableTracks = tracks.filter((t) => t.kind === "track");
    const canDownloadAll = downloadableTracks.length > 1;

    return (
      <div ref={ref}>
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-x-2 flex items-center">
                <CardTitle>{t("results")}</CardTitle>
                <p className="text-muted-foreground">
                  {t("results_found")}: {downloadableTracks.length}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center justify-between sm:justify-start gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    {(dict as any)?.common?.select_quality || "Quality"}
                  </span>
                  <Select
                    value={mp3QualityKbps.toString()}
                    onValueChange={(v) => onMp3QualityKbpsChange(v === "128" ? 128 : 320)}
                  >
                    <SelectTrigger className="w-[110px] h-8 rounded-lg bg-black/5 dark:bg-white/5 border border-white/10 text-xs font-semibold">
                      <SelectValue placeholder="320 kbps" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="128">128 kbps</SelectItem>
                      <SelectItem value="320">320 kbps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {canDownloadAll && (
                  <Button
                    onClick={onDownloadAll}
                    disabled={isDownloadingAll || isAnyLoading}
                    variant="outline"
                    className="transition-all duration-200 border-transparent text-white bg-gradient-to-r from-[#FF5500] to-[#FF0000] hover:from-[#FF0000] hover:to-[#FF5500]"
                  >
                    {isDownloadingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("downloading_all")}
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="w-4 h-4 mr-2" />
                        {t("download_all")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 py-4 space-y-3">
            {downloadableTracks.map((item) => (
              <div key={item.id}>
                <ResultCard
                  item={item}
                  mp3QualityKbps={mp3QualityKbps}
                  progress={getProgress(item.id)}
                  onDownload={onDownloadSingle}
                  isDownloadingAll={isAnyLoading}
                  activePreviewId={previewItem?.id}
                  onPreview={onPreview}
                  source="soundcloud"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }
);

SoundCloudResults.displayName = "SoundCloudResults";
