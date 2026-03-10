import YtdlpWrap from "yt-dlp-wrap";
import path from "path";
import fs from "fs";
import os from "os";

// Ensure we have a place to store the binary
const getBinaryPath = () => {
    // Vercel / serverless environments often only allow writing to /tmp
    if (process.env.VERCEL || process.platform !== 'win32') {
        return path.join(os.tmpdir(), 'yt-dlp');
    }
    return path.join(process.cwd(), 'bin', 'yt-dlp.exe');
};

export const initYtDlp = async () => {
    const binaryPath = getBinaryPath();

    // Ensure directory exists if it's local bin
    const dir = path.dirname(binaryPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(binaryPath)) {
        console.log(`Downloading yt-dlp to ${binaryPath}...`);
        try {
            await YtdlpWrap.downloadFromGithub(binaryPath);
            // On Linux/Mac, ensure it is executable
            if (process.platform !== 'win32') {
                fs.chmodSync(binaryPath, '755');
            }
        } catch (e) {
            console.error("Failed to download yt-dlp", e);
            throw e;
        }
    }

    return new YtdlpWrap(binaryPath);
};

// Common arguments for robustness - Removed --ffmpeg-location to avoid server-side dependency
export const commonYtDlpArgs = [
    "--no-check-certificates",
    "--js-runtime", "node",
    "--prefer-free-formats",
    "--no-warnings",
];

export const formatYtDlpError = (error: any): string => {
    const rawMessage = error instanceof Error ? error.message : String(error);

    // Extract YouTube specific error message if present
    // Format usually: ERROR: [youtube] ID: YouTube said: ...
    const ytMatch = rawMessage.match(/YouTube said: (.*)/);
    if (ytMatch && ytMatch[1]) {
        let ytError = ytMatch[1].trim();
        // Remove any trailing "Stderr:" or similar technical suffixes
        ytError = ytError.split("Stderr:")[0].split(". Stderr:")[0].trim();
        return `YouTube Error: ${ytError}`;
    }

    if (rawMessage.includes("The playlist does not exist")) {
        return "The YouTube playlist does not exist. Please check the URL.";
    }

    if (rawMessage.includes("Incomplete YouTube ID")) {
        return "Invalid YouTube URL or ID.";
    }

    // Default to a cleaner version of the error message if it's too technical
    if (rawMessage.includes("Command failed")) {
        // Try to find the actual error in the message
        const lines = rawMessage.split('\n');
        const errorLine = lines.find(line => line.includes('ERROR:'));
        if (errorLine) {
            return errorLine.replace(/ERROR:\s*\[[^\]]+\]\s*[\w-]+:\s*/, '').replace('ERROR:', '').trim();
        }
    }

    return rawMessage;
};

const isUnavailableYouTubeTitle = (title: unknown) => {
    if (typeof title !== "string") return true;
    const trimmed = title.trim();
    if (!trimmed) return true;
    return (
        /^\[(private|deleted|unavailable) video\]$/i.test(trimmed) ||
        /^(private|deleted|unavailable) video$/i.test(trimmed)
    );
};

const filterYouTubeEntries = (entries: unknown[]) => {
    return entries.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const v = entry as any;
        if (typeof v.id !== "string" || !v.id) return false;
        if (v.is_private) return false;
        if (isUnavailableYouTubeTitle(v.title)) return false;
        const availability = typeof v.availability === "string" ? v.availability.toLowerCase() : "";
        if (
            availability &&
            (availability.includes("private") ||
                availability.includes("deleted") ||
                availability.includes("unavailable"))
        ) {
            return false;
        }
        return true;
    });
};

export interface YouTubeVideo {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    uploader: string;
    url: string;
    formats: any[];
}

export interface YouTubePlaylist {
    id: string;
    title: string;
    thumbnail: string;
    uploader: string;
    url: string;
    entries: YouTubeVideo[];
}

export const getYouTubeInfo = async (url: string): Promise<YouTubeVideo | YouTubePlaylist | null> => {
    try {
        const yt = await initYtDlp();
        const metadata = await yt.execPromise([
            url,
            ...commonYtDlpArgs,
            "--dump-json",
            "--no-playlist", // Default to single video if ambiguous, but we might want to detect
            "--flat-playlist", // For playlists, don't get info for every video immediately if it's huge
        ]);

        const json = JSON.parse(metadata);
        // Remove private and deleted videos if this is a playlist response
        if (json.entries && Array.isArray(json.entries)) {
            json.entries = filterYouTubeEntries(json.entries);
        }
        return json;
    } catch (error) {
        console.error("Error fetching YouTube info:", error);
        return null;
    }
};

export const getYouTubeVideo = async (url: string): Promise<any> => {
    try {
        const yt = await initYtDlp();
        const metadata = await yt.execPromise([
            url,
            ...commonYtDlpArgs,
            "--dump-json",
            "--no-playlist"
        ]);
        return JSON.parse(metadata);
    } catch (error) {
        console.error("Error getting YouTube video:", error);
        throw new Error(formatYtDlpError(error));
    }
}

export const getYouTubePlaylist = async (url: string, start?: number, end?: number): Promise<any> => {
    try {
        const yt = await initYtDlp();
        const args = [
            url,
            ...commonYtDlpArgs,
            "--dump-single-json",
            "--flat-playlist"
        ];

        if (start) args.push("--playlist-start", start.toString());
        if (end) args.push("--playlist-end", end.toString());

        const metadata = await yt.execPromise(args);
        const data = JSON.parse(metadata);
        if (data.entries && Array.isArray(data.entries)) {
            data.entries = filterYouTubeEntries(data.entries);
        }
        return data;
    } catch (error) {
        console.error("Error getting YouTube playlist:", error);
        throw new Error(formatYtDlpError(error));
    }
}

export const getYouTubeStream = async (url: string): Promise<any> => {
    try {
        const yt = await initYtDlp();
        const metadata = await yt.execPromise([
            url,
            ...commonYtDlpArgs,
            "--dump-json"
        ]);
        const info = JSON.parse(metadata);
        return info;
    } catch (error) {
        console.error("Error getting stream:", error);
        throw new Error(formatYtDlpError(error));
    }
}

export const deleteVideoFile = async (filePath: string): Promise<void> => {
    try {
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            console.log(`Deleted video file: ${filePath}`);
        } else {
            console.warn(`File not found, cannot delete: ${filePath}`);
        }
    } catch (err) {
        console.error(`Error deleting video file ${filePath}:`, err);
        throw err;
    }
};
