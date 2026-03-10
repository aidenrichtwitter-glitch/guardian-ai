'use client';

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
    DownloadCloud,
    Youtube,
    PlayCircle,
    ListMusic,
    AlertCircle,
    RotateCcw,
    Loader2
} from "lucide-react";

import { useYouTubeDownloader } from "./hooks/useYouTubeDownloader";
import { YouTubeSingleTrackTabContent } from "./YouTubeSingleTrackTabContent";
import { YouTubePlaylistTabContent } from "./YouTubePlaylistTabContent";
import { ResultCard } from "@/components/common/ResultCard";
import { AudioPlayer } from "../soundcloud/AudioPlayer";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { YouTubeItem } from "./types";
import dictionary from "@/lib/dictionary.json";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface YouTubeDownloaderProps {
    hideInput?: boolean;
    hideControls?: boolean;
    externalQuery?: string;
    externalMode?: 'single' | 'playlist';
    externalMp3QualityKbps?: 128 | 320;
}

export function YouTubeDownloader({ hideInput, hideControls, externalQuery, externalMode, externalMp3QualityKbps }: YouTubeDownloaderProps) {
    const dict = dictionary;
    const { state, actions } = useYouTubeDownloader();
    const t = (key: string) => (dict as any)?.common?.[key] || key;

    const effectiveTab = externalMode ?? state.activeTab;

    React.useEffect(() => {
        if (externalMode && externalMode !== state.activeTab) {
            actions.setActiveTab(externalMode);
        }
    }, [externalMode, state.activeTab, actions.setActiveTab]);

    React.useEffect(() => {
        if (externalMp3QualityKbps) {
            actions.setMp3QualityKbps(externalMp3QualityKbps);
        }
    }, [externalMp3QualityKbps, actions.setMp3QualityKbps]);

    const tabContents = (
        <>
            <TabsContent value="single" className="space-y-4">
                <YouTubeSingleTrackTabContent
                    setItems={actions.setItems}
                    setIsLoading={actions.setIsLoading}
                    setError={actions.setError}
                    isLoading={state.isLoading}
                    hideInput={hideInput}
                    externalQuery={externalQuery}
                />
            </TabsContent>

            <TabsContent value="playlist" className="space-y-4">
                <YouTubePlaylistTabContent
                    setItems={actions.setItems}
                    setIsLoading={actions.setIsLoading}
                    setError={actions.setError}
                    isLoading={state.isLoading}
                    hideInput={hideInput}
                    externalQuery={externalQuery}
                />
            </TabsContent>
        </>
    );

    const activeContent =
        effectiveTab === "playlist" ? (
            <YouTubePlaylistTabContent
                setItems={actions.setItems}
                setIsLoading={actions.setIsLoading}
                setError={actions.setError}
                isLoading={state.isLoading}
                hideInput={hideInput}
                externalQuery={externalQuery}
            />
        ) : (
            <YouTubeSingleTrackTabContent
                setItems={actions.setItems}
                setIsLoading={actions.setIsLoading}
                setError={actions.setError}
                isLoading={state.isLoading}
                hideInput={hideInput}
                externalQuery={externalQuery}
            />
        );

    return (
        <div className="w-full max-w-4xl mx-auto p-2 space-y-4">
            {!hideControls && (
                <Card className="backdrop-blur-sm">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <CardTitle className="flex items-center gap-2">
                                <Youtube className="w-6 h-6 text-red-500" />
                                <span>YouTube Downloader</span>
                            </CardTitle>

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
                                            FFmpeg Active
                                        </span>
                                    ) : "FFmpeg Ready"}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={state.activeTab} onValueChange={actions.setActiveTab}>
                            {!hideInput && (
                                <div>
                                    <AnimatedTabs
                                        activeTab={state.activeTab}
                                        onTabChange={actions.setActiveTab}
                                        tabs={[
                                            {
                                                id: "single",
                                                label: (dict as any).youtube.tabs.single || "Single",
                                                icon: <PlayCircle className="w-4 h-4" />,
                                            },
                                            {
                                                id: "playlist",
                                                label: (dict as any).youtube.tabs.playlist || "Playlist",
                                                icon: <ListMusic className="w-4 h-4" />,
                                            },
                                        ]}
                                        layoutId="yt-tab-bubble"
                                        className="w-full sm:w-auto"
                                    />
                                </div>
                            )}

                            {tabContents}
                        </Tabs>
                    </CardContent>
                </Card>
            )}

            {hideControls && activeContent}

            {state.isLoading && state.items.length === 0 && (
                <Card>
                    <CardContent className="py-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-foreground/70" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold tracking-tight">Fetching info…</p>
                                <p className="text-xs text-muted-foreground truncate">{t("downloading")}</p>
                            </div>
                        </div>

                        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-foreground/5 border border-border">
                            <div className="h-full w-1/3 bg-gradient-to-r from-[#FF0000] to-[#FF5500] animate-[indeterminate_1.2s_ease_infinite]" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {state.error && (
                <Card className="border-destructive/50">
                    <CardContent className="pt-4">
                        <div className="flex flex-col items-center text-center space-y-3">
                            <AlertCircle className="w-8 h-8 text-destructive" />
                            <div>
                                <h3 className="text-destructive mb-2">{t("error")}</h3>
                                <p className="text-muted-foreground">{state.error}</p>
                            </div>
                            <Button
                                onClick={actions.handleRetry}
                                variant="outline"
                                disabled={state.isLoading}
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                {t("retry")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {state.items.length > 0 && (
                <Card ref={state.resultsRef}>
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle>{t("results")} ({state.items.length})</CardTitle>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            <div className="flex items-center justify-between sm:justify-start gap-2 rounded-xl bg-foreground/5 border border-border px-3 py-2">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                                    {(dict as any)?.common?.select_quality || "Quality"}
                                </span>
                                <Select
                                    value={state.mp3QualityKbps.toString()}
                                    onValueChange={(v) => actions.setMp3QualityKbps(v === "128" ? 128 : 320)}
                                >
                                    <SelectTrigger className="w-[110px] h-8 rounded-lg bg-transparent border border-border text-xs font-semibold">
                                        <SelectValue placeholder="320 kbps" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="128">128 kbps</SelectItem>
                                        <SelectItem value="320">320 kbps</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {state.items.filter(i => i.kind === "video").length > 1 && (
                                <Button
                                    onClick={actions.handleDownloadAll}
                                    disabled={state.isDownloadingAll}
                                    variant="outline"
                                    className="border-transparent text-white bg-gradient-to-r from-[#FF0000] to-[#FF5500] hover:from-[#FF5500] hover:to-[#FF0000]"
                                >
                                    {state.isDownloadingAll ? (
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
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {state.items.map((item) => (
                            <ResultCard
                                key={item.id}
                                item={item}
                                mp3QualityKbps={state.mp3QualityKbps}
                                progress={actions.getProgress(item.id)}
                                onDownload={(item) => actions.handleDownloadSingle(item as YouTubeItem)}
                                isDownloadingAll={state.isDownloadingAll}
                                activePreviewId={state.previewItem?.id}
                                onPreview={(item) => actions.handlePreview(item as YouTubeItem)}
                                source="youtube"
                            />
                        ))}
                    </CardContent>
                </Card>
            )}
            {state.previewItem && (
                <AudioPlayer
                    src={`/api/youtube/download?url=${encodeURIComponent(state.previewItem.url)}&format=mp3&preview=true`}
                    title={state.previewItem.title}
                    artist={state.previewItem.uploader || "YouTube"}
                    thumbnail={state.previewItem.thumbnail}
                    onClose={() => actions.setPreviewItem(null)}
                    disableSeek={true}
                />
            )}
        </div>
    );
}
