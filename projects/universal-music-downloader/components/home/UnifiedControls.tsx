import React from "react";
import { Input } from "@/components/ui/input";
import { Link as LinkIcon, Loader2, Music, Youtube } from "lucide-react";
import { motion } from "motion/react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import dictionary from "@/lib/dictionary.json";

interface UnifiedControlsProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSubmit: () => void;
    mp3QualityKbps: 128 | 320;
    onMp3QualityKbpsChange: (quality: 128 | 320) => void;
    canSubmit?: boolean;
    isLoading?: boolean;
}

export function UnifiedControls({
    inputValue,
    onInputChange,
    onSubmit,
    mp3QualityKbps,
    onMp3QualityKbpsChange,
    canSubmit = true,
    isLoading
}: UnifiedControlsProps) {
    const dict = dictionary;

    const getServiceIcon = () => {
        const lower = inputValue.toLowerCase();
        if (lower.includes("soundcloud.com") || lower.includes("on.soundcloud.com")) {
            return (
                <Music className="w-4 h-4 text-foreground/50 animate-in zoom-in duration-300" />
            );
        }
        if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
            return (
                <Youtube className="w-4 h-4 text-foreground/50 animate-in zoom-in duration-300" />
            );
        }
        return <LinkIcon className="w-4 h-4 text-foreground/30" />;
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative bg-card backdrop-blur-2xl border border-border shadow-2xl shadow-black/10 dark:shadow-black/40 rounded-3xl p-2.5 overflow-hidden"
            >
                {/* Glass Highlights */}
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-[#FF5500]/8 via-foreground/5 to-transparent rotate-12 pointer-events-none" />

                <div className="flex flex-col sm:flex-row gap-2 items-stretch relative z-10">
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-all duration-300">
                            {getServiceIcon()}
                        </div>
                        <Input
                            value={inputValue}
                            onChange={(e) => onInputChange(e.target.value)}
                            placeholder={dict?.common?.placeholder_unified || "Paste SoundCloud or YouTube URL..."}
                            className="pl-10 pr-16 h-14 text-base sm:text-lg shadow-none border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/25 focus-visible:ring-2 focus-visible:ring-white/15 focus-visible:ring-offset-0 font-medium rounded-2xl placeholder:text-foreground/35"
                            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40">
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <span className="text-[10px] font-bold tracking-widest uppercase">
                                    Auto
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 px-1">
                        <span className="text-[10px] text-foreground/40 font-bold tracking-widest uppercase">
                            {(dict as any)?.common?.select_quality || "Quality"}
                        </span>
                        <Select
                            value={mp3QualityKbps.toString()}
                            onValueChange={(v) => onMp3QualityKbpsChange(v === "128" ? 128 : 320)}
                        >
                            <SelectTrigger className="w-[110px] h-10 rounded-xl bg-black/5 dark:bg-black/25 border border-black/10 dark:border-white/10 text-xs font-semibold">
                                <SelectValue placeholder="320 kbps" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="128">128 kbps</SelectItem>
                                <SelectItem value="320">320 kbps</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </motion.div>

            {!canSubmit && inputValue.trim().length > 0 && (
                <p className="mt-2 text-center text-[11px] text-foreground/40">
                    Only SoundCloud and YouTube links are supported.
                </p>
            )}
            <p className="mt-2 text-center text-[11px] text-foreground/30">
                Paste a link — fetch starts automatically.
            </p>
        </div>
    );
}
