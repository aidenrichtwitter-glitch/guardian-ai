import React from "react";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { PlayCircle, ListMusic, Music } from "lucide-react";
import dictionary from "@/lib/dictionary.json";

interface SoundCloudTabsProps {
    activeTab: string;
    onTabChange: (value: string) => void;
    children: React.ReactNode;
    hideTabsList?: boolean;
}

export function SoundCloudTabs({
    activeTab,
    onTabChange,
    children,
    hideTabsList,
}: SoundCloudTabsProps) {
    const dict = dictionary;
    if (hideTabsList) {
        return (
            <Tabs value={activeTab} onValueChange={onTabChange}>
                {children}
            </Tabs>
        );
    }

    return (
        <div>
            <Card className="backdrop-blur-sm">
                <CardHeader>
                    <div className="flex justify-center items-center">
                        <CardTitle className="flex items-center gap-2">
                            <div>
                                <Music className="w-6 h-6" />
                            </div>
                            <span>SoundCloud MP3 Downloader</span>
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={onTabChange}>
                        <div>
                            <AnimatedTabs
                                activeTab={activeTab}
                                onTabChange={onTabChange}
                                tabs={[
                                    {
                                        id: "single",
                                        label: (dict as any).soundcloud.tabs.single || "Single",
                                        icon: <PlayCircle className="w-4 h-4" />,
                                    },
                                    {
                                        id: "playlist",
                                        label: (dict as any).soundcloud.tabs.playlist || "Playlist",
                                        icon: <ListMusic className="w-4 h-4" />,
                                    },
                                ]}
                                layoutId="sc-tab-bubble"
                                className="w-full sm:w-auto"
                            />
                        </div>
                        {children}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
