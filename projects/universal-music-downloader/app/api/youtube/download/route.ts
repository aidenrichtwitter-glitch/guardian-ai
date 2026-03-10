import { NextRequest, NextResponse } from "next/server";
import { initYtDlp, commonYtDlpArgs } from "@/lib/youtube-api";

function detectAudioContainer(chunk: Uint8Array): { contentType: string; ext: string } {
    // MP4/M4A: look for 'ftyp' within first bytes
    const ascii = new TextDecoder().decode(chunk.slice(0, 256));
    if (ascii.includes("ftyp")) return { contentType: "audio/mp4", ext: "m4a" };

    // WebM/Matroska: EBML header 1A 45 DF A3
    if (chunk.length >= 4 && chunk[0] === 0x1a && chunk[1] === 0x45 && chunk[2] === 0xdf && chunk[3] === 0xa3) {
        return { contentType: "audio/webm", ext: "webm" };
    }

    // OGG
    if (ascii.startsWith("OggS")) return { contentType: "audio/ogg", ext: "ogg" };

    // MP3 (ID3 or frame sync)
    if (ascii.startsWith("ID3")) return { contentType: "audio/mpeg", ext: "mp3" };
    if (chunk.length >= 2 && chunk[0] === 0xff && (chunk[1] & 0xe0) === 0xe0) {
        return { contentType: "audio/mpeg", ext: "mp3" };
    }

    return { contentType: "application/octet-stream", ext: "bin" };
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    try {
        const yt = await initYtDlp();

	        // Construct arguments
	        // -o - writes to stdout
	        // Force a single item even if a playlist URL is passed.
	        let args = [
	            url,
	            "--no-playlist",
	            "-o",
	            "-",
	            // Prefer audio-only formats that don't require server-side ffmpeg/merging.
	            "-f",
	            "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[ext=ogg]/bestaudio",
	        ];
	        args.push(...commonYtDlpArgs);

        console.log("Starting yt-dlp with args:", args.join(" "));

        const nodeStream = yt.execStream(args);

        // Peek the first chunk to set a sane Content-Type for preview playback.
        const firstChunk = await new Promise<Uint8Array | null>((resolve, reject) => {
            const onData = (chunk: Uint8Array) => resolve(chunk);
            const onError = (err: unknown) => reject(err);
            const onEnd = () => resolve(null);

            nodeStream.once("data", onData);
            nodeStream.once("error", onError);
            nodeStream.once("end", onEnd);
        });

	        const detected = firstChunk ? detectAudioContainer(firstChunk) : { contentType: "application/octet-stream", ext: "bin" };
	
	        // Convert Node.js stream to Web ReadableStream for better Next.js compatibility
	        const stream = new ReadableStream({
	            start(controller) {
	                let isClosed = false;
	                const onAbort = () => {
	                    try {
	                        nodeStream.destroy();
	                    } finally {
	                        safeClose();
	                    }
	                };

	                const cleanup = () => {
	                    nodeStream.off("data", onData);
	                    nodeStream.off("end", onEnd);
	                    nodeStream.off("close", onClose);
	                    nodeStream.off("error", onError);
	                    req.signal.removeEventListener("abort", onAbort);
	                };

	                const safeClose = () => {
	                    if (isClosed) return;
	                    isClosed = true;
	                    cleanup();
	                    try {
	                        controller.close();
	                    } catch {
	                        // Ignore invalid state (e.g. client canceled request)
	                    }
	                };

	                const safeError = (err: unknown) => {
	                    if (isClosed) return;
	                    isClosed = true;
	                    cleanup();
	                    try {
	                        controller.error(err);
	                    } catch {
	                        // Ignore invalid state (e.g. client canceled request)
	                    }
	                };

	                const onData = (chunk: Uint8Array) => {
	                    if (isClosed) return;
	                    try {
	                        controller.enqueue(chunk);
	                    } catch (err) {
	                        safeError(err);
	                    }
	                };

	                const onEnd = () => safeClose();
	                const onClose = () => safeClose();
	                const onError = (err: unknown) => {
	                    console.error("yt-dlp stream error:", err);
	                    safeError(err);
	                };

	                req.signal.addEventListener("abort", onAbort);

	                if (firstChunk) onData(firstChunk);
	                nodeStream.on("data", onData);
	                nodeStream.on("end", onEnd);
	                nodeStream.on("close", onClose);
	                nodeStream.on("error", onError);
	            },
	            cancel() {
	                try {
	                    nodeStream.destroy();
	                } catch {
	                    // ignore
	                }
	            },
	        });

        // Access underlying process if available for logging
        const childProcess = (nodeStream as any).ytDlpProcess;

	        if (childProcess) {
	            childProcess.stderr?.on('data', (data: any) => {
	                const message = data.toString();
	                const normalized = message.trim().toLowerCase();
	                const shouldIgnore =
	                    !normalized ||
	                    normalized.includes("%") ||
	                    normalized.includes("ffmpeg not found") ||
	                    normalized.includes("unavailable video is hidden");
	
	                if (!shouldIgnore) {
	                    console.error(`yt-dlp stderr: ${message}`);
	                }
	            });

            childProcess.on('error', (err: any) => {
                console.error("Failed to start yt-dlp:", err);
            });

            childProcess.on('close', (code: any) => {
                if (code !== 0) {
                    console.error(`yt-dlp exited with code ${code}`);
                } else {
                    console.log("yt-dlp finished successfully");
                }
            });
        }


        const isPreview = req.nextUrl.searchParams.get("preview") === "true";
        const title = req.nextUrl.searchParams.get("title") || "download";

        // Remove characters that are unsafe for header values and non-ASCII for the basic 'filename' parameter
        const safeTitle = title
            .replace(/["\\]/g, '')
            .replace(/[^\x20-\x7E]/g, '_'); // Replace non-ASCII with underscore for fallback

        const encodedTitle = encodeURIComponent(title);
        const fileExt = detected.ext;

        // Return the stream
        const headers = new Headers();

        // Standard way to handle UTF-8 filenames in Content-Disposition
        const dispositionType = isPreview ? 'inline' : 'attachment';
        headers.set(
            "Content-Disposition",
            `${dispositionType}; filename="${safeTitle}.${fileExt}"; filename*=UTF-8''${encodedTitle}.${fileExt}`
        );

        headers.set("Content-Type", detected.contentType);

        return new NextResponse(stream, { headers });

    } catch (error: any) {
        console.error("Download API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to download" },
            { status: 500 }
        );
    }
}
