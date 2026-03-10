export interface YouTubeItem {
    id: string;
    kind: "video" | "playlist";
    title: string;
    uploader?: string;
    duration?: number;
    thumbnail: string;
    url: string;
}

export interface DownloadProgress {
    id: string;
    progress: number;
    status: "downloading" | "completed" | "error";
}
