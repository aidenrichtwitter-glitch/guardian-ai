export interface SearchResultItem {
    id: string;
    kind: "track" | "playlist" | "video";
    title: string;
    artist?: string;
    duration?: number;
    thumbnail?: string;
    url: string;
    genre?: string;
    releaseDate?: string;
    artworkUrl?: string;
}

export interface DownloadProgress {
    id: string;
    progress: number;
    status: "downloading" | "completed" | "error";
}
