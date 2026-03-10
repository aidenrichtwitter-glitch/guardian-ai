'use client';

import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

export function useFFmpeg() {
    const [loaded, setLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const ffmpegRef = useRef<FFmpeg | null>(null);

    const load = useCallback(async () => {
        if (ffmpegRef.current) return ffmpegRef.current;

        setIsLoading(true);
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;

        ffmpeg.on('progress', ({ progress }: { progress: number }) => {
            setProgress(Math.round(progress * 100));
        });

        try {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            setLoaded(true);
            return ffmpeg;
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const processAudio = useCallback(async (
        inputBlob: Blob,
        options: {
            title?: string,
            artist?: string,
            album?: string,
            format?: 'mp3' | 'wav' | 'flac',
            mp3BitrateKbps?: 128 | 320,
            coverBlob?: Blob
        }
    ): Promise<Blob> => {
        const ffmpeg = await load();
        const { title, artist, album, format = 'mp3', mp3BitrateKbps = 320, coverBlob } = options;
        const inputName = 'input_file';
        const outputName = `output.${format}`;
        const coverName = 'cover.jpg';

        await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));

        const args = ['-i', inputName];

        if (coverBlob && format === 'mp3') {
            await ffmpeg.writeFile(coverName, await fetchFile(coverBlob));
            args.push('-i', coverName, '-map', '0:a:0', '-map', '1:0');
        }

        if (title) args.push('-metadata', `title=${title}`);
        if (artist) args.push('-metadata', `artist=${artist}`);
        if (album) args.push('-metadata', `album=${album}`);

        if (format === 'mp3') {
            args.push('-c:a', 'libmp3lame', '-b:a', `${mp3BitrateKbps}k`, '-id3v2_version', '3');
        } else if (format === 'flac') {
            args.push('-sample_fmt', 's16');
        }

        args.push(outputName);

        await ffmpeg.exec(args);

        const data = await ffmpeg.readFile(outputName);
        const mimeType = format === 'mp3' ? 'audio/mpeg' : format === 'flac' ? 'audio/flac' : 'audio/wav';
        // Use 'any' to bypass SharedArrayBuffer vs ArrayBuffer type mismatch 
        return new Blob([data as any], { type: mimeType });
    }, [load]);

    return {
        load,
        loaded,
        isLoading,
        progress,
        processAudio,
    };
}
