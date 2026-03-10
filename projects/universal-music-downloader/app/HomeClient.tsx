'use client';

import { motion } from "motion/react";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// Components
import { SoundCloudDownloader } from "@/components/features/soundcloud/SoundCloudDownloader";
import { YouTubeDownloader } from "@/components/features/youtube/YouTubeDownloader";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { Footer } from "@/components/home/Footer";
import { UnifiedControls } from "@/components/home/UnifiedControls";
import dictionary from "@/lib/dictionary.json";

// Hooks
import { useDebounce } from "@/hooks/use-debounce";
import { useServiceDetection } from "@/hooks/use-service-detection";
import { useClientId } from "@/contexts/ClientIdProvider";

type DownloadMode = "single" | "playlist";
type Mp3QualityKbps = 128 | 320;

export default function HomeClient() {
    const dict = dictionary;
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [mp3QualityKbps, setMp3QualityKbps] = useState<Mp3QualityKbps>(320);
    useEffect(() => {
        try {
            const stored = localStorage.getItem("umd_mp3_quality");
            if (stored === "128") {
                setMp3QualityKbps(128);
            } else if (stored === "320") {
                setMp3QualityKbps(320);
            }
        } catch {
            // Ignore storage access errors (private mode, etc.)
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("umd_mp3_quality", mp3QualityKbps.toString());
        } catch {
            // Ignore storage access errors
        }
    }, [mp3QualityKbps]);

    // Input state
    const [inputValue, setInputValue] = useState("");
    const [submittedUrl, setSubmittedUrl] = useState("");

    // Initial load from query parameter
    useEffect(() => {
        const queryUrl = searchParams.get('url');
        if (queryUrl) {
            const trimmed = queryUrl.trim();
            setInputValue(trimmed);
            setSubmittedUrl(trimmed);
        }
    }, [searchParams]);

    // Update query parameter when URL is submitted
    useEffect(() => {
        const currentUrl = searchParams.get('url');
        if (submittedUrl && submittedUrl !== currentUrl) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('url', submittedUrl);
            router.replace(`${pathname}?${params.toString()}`);
        } else if (!submittedUrl && currentUrl) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('url');
            const query = params.toString();
            router.replace(`${pathname}${query ? `?${query}` : ''}`);
        }
    }, [submittedUrl, pathname, router, searchParams]);

    const debouncedInputValue = useDebounce(inputValue, 250);

    // Service detection (input vs submitted)
    const inputDetection = useServiceDetection(inputValue);
    const submittedDetection = useServiceDetection(submittedUrl);

    const {
        clientId: soundCloudClientId,
        isLoading: isSoundCloudClientIdLoading,
        error: soundCloudClientIdError,
    } = useClientId();

    const handleUnifiedSubmit = useCallback(() => {
        if (!inputValue.trim() || !inputDetection.isValid) return;
        setSubmittedUrl(inputValue.trim());
    }, [inputValue, inputDetection.isValid]);

    // Auto-trigger on debounced input if it looks like a URL
    useEffect(() => {
        const trimmed = debouncedInputValue.trim();
        if (!trimmed) return;
        if (!inputDetection.isValid) return;
        if (trimmed === submittedUrl) return;
        handleUnifiedSubmit();
    }, [debouncedInputValue, inputDetection.isValid, submittedUrl, handleUnifiedSubmit]);

    // Determine if ready to render (for SoundCloud, wait for prefetch)
    const needsSoundCloudClientId =
        submittedDetection.isUrl && submittedDetection.service === "soundcloud";

    const isReady = !needsSoundCloudClientId || soundCloudClientId !== null;

    const isLoading =
        isSoundCloudClientIdLoading &&
        needsSoundCloudClientId;
    return (
        <div className="min-h-screen text-foreground selection:bg-foreground selection:text-background relative overflow-x-hidden">

            <HeroSection
                title={dict.hero.title}
                description={dict.hero.description}
            />

            {/* Main App Section */}
            <section className="max-w-4xl mx-auto px-4 pb-12 relative z-10">

                {/* Unified Controls */}
                <div className="mb-6">
                    <UnifiedControls
                        inputValue={inputValue}
                        onInputChange={setInputValue}
                        onSubmit={handleUnifiedSubmit}
                        mp3QualityKbps={mp3QualityKbps}
                        onMp3QualityKbpsChange={setMp3QualityKbps}
                        canSubmit={inputDetection.isValid}
                        isLoading={isLoading}
                    />
                </div>

                {/* Content Area - Show detected service when ready */}
                <motion.div
                    key={`${submittedDetection.service}-${submittedDetection.mode}`}
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -10 }}
                    transition={{
                        duration: 0.4,
                        ease: [0.16, 1, 0.3, 1]
                    }}
                    className="min-h-[400px]"
                >
                    {isReady ? (
                        submittedDetection.service === "soundcloud" ? (
                            <SoundCloudDownloader
                                hideInput={true}
                                hideControls={true}
                                externalQuery={submittedUrl}
                                externalMode={submittedDetection.mode as DownloadMode}
                                externalMp3QualityKbps={mp3QualityKbps}
                            />
                        ) : submittedDetection.service === "youtube" ? (
                            <YouTubeDownloader
                                hideInput={true}
                                hideControls={true}
                                externalQuery={submittedUrl}
                                externalMode={submittedDetection.mode as DownloadMode}
                                externalMp3QualityKbps={mp3QualityKbps}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                <p className="text-foreground/60 text-sm">Paste a SoundCloud or YouTube link to start.</p>
                                <p className="text-foreground/30 text-xs">Only direct URLs are supported.</p>
                            </div>
                        )
                    ) : (
                        // Loading/Error state for SoundCloud prefetch
                        <div className="flex flex-col items-center justify-center gap-4 py-12">
                            {soundCloudClientIdError ? (
                                <>
                                    <div className="h-12 w-12 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                                        <span className="text-red-500">⚠</span>
                                    </div>
                                    <p className="text-foreground/50 text-sm">Failed to load SoundCloud</p>
                                    <p className="text-foreground/30 text-xs">{soundCloudClientIdError}</p>
                                </>
                            ) : (
                                <>
                                    <div className="h-12 w-12 border-4 border-foreground/10 border-t-foreground rounded-full animate-spin" />
                                    <p className="text-foreground/50 text-sm">Preparing SoundCloud...</p>
                                    <div className="w-full max-w-sm h-2 overflow-hidden rounded-full bg-white/10 border border-white/10">
                                        <div className="h-full w-1/3 bg-gradient-to-r from-[#FF5500] to-[#FF0000] animate-[indeterminate_1.2s_ease_infinite]" />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </motion.div>
            </section>

            <FeaturesSection
                title={dict.features.title}
                features={dict.features}
            />

            <Footer text={dict.footer.text} />
        </div>
    );
}
