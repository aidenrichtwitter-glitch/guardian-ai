'use client';
import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { SingleTrackTabContent } from "./SingleTrackTabContent";
import { PlaylistTabContent } from "./PlaylistTabContent";
import { AudioPlayer } from "./AudioPlayer";
import { getDownloadApiPath } from "@/lib/get-api-endpoint";

import { useSoundCloudDownloader } from "./hooks/useSoundCloudDownloader";
import { SoundCloudTabs } from "./_components/SoundCloudTabs";
import { SoundCloudStatus } from "./_components/SoundCloudStatus";
import { SoundCloudResults } from "./_components/SoundCloudResults";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import dictionary from "@/lib/dictionary.json";

interface SoundCloudDownloaderProps {
  hideInput?: boolean;
  hideControls?: boolean;
  externalQuery?: string;
  externalMode?: 'single' | 'playlist';
  externalMp3QualityKbps?: 128 | 320;
}

export function SoundCloudDownloader({ hideInput, hideControls, externalQuery, externalMode, externalMp3QualityKbps }: SoundCloudDownloaderProps) {
  const dict = dictionary;
  const { state, actions } = useSoundCloudDownloader();
  const t = (key: string) => (dict as any)?.common?.[key] || key;

  const effectiveTab = externalMode ?? state.activeTab;

  // Sync external mode to active tab
  React.useEffect(() => {
    if (externalMode && externalMode !== state.activeTab) {
      actions.setActiveTab(externalMode);
    }
  }, [externalMode, state.activeTab, actions.setActiveTab]);

  // Sync external MP3 quality
  React.useEffect(() => {
    if (externalMp3QualityKbps) {
      actions.setMp3QualityKbps(externalMp3QualityKbps);
    }
  }, [externalMp3QualityKbps, actions.setMp3QualityKbps]);

  return (
    <div className="w-full max-w-4xl mx-auto p-2 space-y-4">
      {!hideControls && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card/50 backdrop-blur-sm p-4 rounded-xl border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
            SoundCloud Downloader
          </h2>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground font-medium">{(dict as any)?.common?.select_quality || "Quality"}</span>
              <Select
                value={state.mp3QualityKbps.toString()}
                onValueChange={(v) => actions.setMp3QualityKbps((v === "128" ? 128 : 320) as 128 | 320)}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="320 kbps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">128 kbps</SelectItem>
                  <SelectItem value="320">320 kbps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Badge variant={state.isAnyLoading ? "outline" : "secondary"} className="h-6">
              {state.isAnyLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  FFmpeg
                </span>
              ) : "FFmpeg Ready"}
            </Badge>
          </div>
        </div>
      )}

      {/* If inputs are hidden, we don't need Tabs UI, but we still need the content 
          rendered based on activeTab to handle the fetching logic.
      */}
      {hideInput ? (
        effectiveTab === "playlist" ? (
          <PlaylistTabContent
            setTracks={actions.setTracks}
            setIsLoading={actions.setIsLoading}
            setError={actions.setError}
            isLoading={state.isLoading}
            isAnyLoading={state.isAnyLoading}
            clientId={state.clientId}
            hideInput={hideInput}
            externalQuery={externalQuery}
          />
        ) : (
          <SingleTrackTabContent
            setTracks={actions.setTracks}
            setIsLoading={actions.setIsLoading}
            setError={actions.setError}
            isLoading={state.isLoading}
            isAnyLoading={state.isAnyLoading}
            clientId={state.clientId}
            hideInput={hideInput}
            externalQuery={externalQuery}
          />
        )
      ) : (
        <SoundCloudTabs
          activeTab={state.activeTab}
          onTabChange={actions.setActiveTab}
          hideTabsList={hideInput}
        >
          <TabsContent value="single" className="mt-0">
            <SingleTrackTabContent
              setTracks={actions.setTracks}
              setIsLoading={actions.setIsLoading}
              setError={actions.setError}
              isLoading={state.isLoading}
              isAnyLoading={state.isAnyLoading}
              clientId={state.clientId}
              hideInput={hideInput}
              externalQuery={externalQuery}
            />
          </TabsContent>
          <TabsContent value="playlist" className="mt-0">
            <PlaylistTabContent
              setTracks={actions.setTracks}
              setIsLoading={actions.setIsLoading}
              setError={actions.setError}
              isLoading={state.isLoading}
              isAnyLoading={state.isAnyLoading}
              clientId={state.clientId}
              hideInput={hideInput}
              externalQuery={externalQuery}
            />
          </TabsContent>
        </SoundCloudTabs>
      )}

      <SoundCloudStatus
        isLoading={state.isLoading}
        error={state.error}
        tracksLength={state.tracks.length}
        isAnyLoading={state.isAnyLoading}
        onRetry={actions.handleRetry}
      />

      <SoundCloudResults
        ref={state.resultsRef}
        tracks={state.tracks}
        isDownloadingAll={state.isDownloadingAll}
        isAnyLoading={state.isAnyLoading}
        mp3QualityKbps={state.mp3QualityKbps}
        onMp3QualityKbpsChange={actions.setMp3QualityKbps}
        onDownloadAll={actions.handleDownloadAll}
        onDownloadSingle={actions.handleDownloadSingle}
        getProgress={actions.getProgressForTrack}
        previewItem={state.previewItem}
        onPreview={actions.handlePreview}
      />

      {state.previewItem && state.clientId && (
        <AudioPlayer
          src={getDownloadApiPath(state.previewItem.url, state.previewItem.title, state.clientId) + "&preview=true"}
          title={state.previewItem.title}
          artist={state.previewItem.artist || 'SoundCloud'}
          thumbnail={state.previewItem.thumbnail}
          onClose={() => actions.setPreviewItem(null)}
          disableSeek={true}
        />
      )}
    </div>
  );
}
