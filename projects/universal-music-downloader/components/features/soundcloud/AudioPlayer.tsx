import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, X, Volume2, VolumeX, Loader2 } from "lucide-react";
import Image from "next/image";

interface AudioPlayerProps {
    src: string;
    title: string;
    artist: string;
    thumbnail?: string;
    onClose: () => void;
    autoPlay?: boolean;
    disableSeek?: boolean;
}

export function AudioPlayer({ src, title, artist, thumbnail, onClose, autoPlay = true, disableSeek = false }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);

    const [sliderValue, setSliderValue] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        // Reset state when src changes
        const audio = new Audio(src);
        audioRef.current = audio;
        audio.preload = "metadata";

        const setAudioData = () => {
            setDuration(audio.duration);
            setIsLoading(false);
            if (autoPlay) {
                audio.play().catch(e => console.error("Autoplay failed", e));
            }
        };

        const setAudioTime = () => {
            if (!isDragging) {
                setCurrentTime(audio.currentTime);
                setSliderValue(audio.currentTime);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            setSliderValue(0);
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleWaiting = () => setIsLoading(true);
        const handleCanPlay = () => setIsLoading(false);
        const handleError = (e: any) => {
            console.error("Audio error", e);
            setIsLoading(false);
            setIsPlaying(false);
        };

        audio.addEventListener("loadedmetadata", setAudioData);
        audio.addEventListener("timeupdate", setAudioTime);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("waiting", handleWaiting);
        audio.addEventListener("canplay", handleCanPlay);
        audio.addEventListener("error", handleError);

        return () => {
            audio.pause();
            audio.removeEventListener("loadedmetadata", setAudioData);
            audio.removeEventListener("timeupdate", setAudioTime);
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("waiting", handleWaiting);
            audio.removeEventListener("canplay", handleCanPlay);
            audio.removeEventListener("error", handleError);
            audioRef.current = null;
        };
    }, [src, autoPlay, isDragging]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
    };

    const handleSeek = (value: number[]) => {
        if (disableSeek) return;
        setSliderValue(value[0]);
        // Optional: seeking while dragging (scrubbing)
        // const audio = audioRef.current;
        // if (audio) audio.currentTime = value[0];
    };

    const handleSeekCommit = (value: number[]) => {
        if (disableSeek) return;
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = value[0];
            setCurrentTime(value[0]);
        }
        setIsDragging(false);
    };

    const handleSeekStart = () => {
        if (disableSeek) return;
        setIsDragging(true);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const formatTime = (time: number) => {
        if (!time && time !== 0) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 p-4 shadow-lg animate-in slide-in-from-bottom duration-300">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
                {/* Thumbnail & Info */}
                <div className="flex items-center gap-3 w-48 sm:w-64">
                    {thumbnail ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-foreground/5 border border-border relative">
                            <Image
                                src={thumbnail}
                                alt={title}
                                fill
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">MP3</span>
                        </div>
                    )}
                    <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate">{title}</h4>
                        <p className="text-xs text-muted-foreground truncate">{artist}</p>
                    </div>
                </div>

                {/* Controls & Progress */}
                <div className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-center gap-4">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={togglePlay}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : isPlaying ? (
                                <Pause className="h-5 w-5" />
                            ) : (
                                <Play className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                    <div className="w-full flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-10 text-right tabular-nums">{formatTime(sliderValue)}</span>
                        <Slider
                            value={[sliderValue]}
                            max={duration || 100}
                            step={1}
                            onValueChange={handleSeek}
                            onValueCommit={handleSeekCommit}
                            disabled={disableSeek}
                            className={`flex-1 ${disableSeek ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            onPointerDown={handleSeekStart}
                        />
                        <span className="w-10 tabular-nums">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Volume & Close */}
                <div className="flex items-center gap-2 pl-4 border-l">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex"
                        onClick={toggleMute}
                    >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={onClose}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
