export interface SoundCloudUser {
  id: number;
  kind: "user";
  username: string;
  avatar_url: string;
  permalink_url: string;
  // Add other user properties as needed
}

export interface SoundCloudTrack {
  id: number;
  kind: "track";
  title: string;
  duration: number;
  permalink_url: string;
  artwork_url: string;
  user?: SoundCloudUser; // Optional, as it might be missing
  publisher_metadata?: {
    artist?: string;
    // Add other publisher_metadata properties as needed
  };
  media: {
    transcodings: Array<{
      url: string;
      preset: string;
      duration: number;
      snipped: boolean;
      format: {
        protocol: string;
        mime_type: string;
      };
    }>;
  };
  // Add other track properties as needed
}

export interface SoundCloudPlaylist {
  id: number;
  kind: "playlist";
  title: string;
  permalink_url: string;
  artwork_url: string;
  // Add other playlist properties as needed
}

export type SoundCloudSearchItem = SoundCloudTrack | SoundCloudUser | SoundCloudPlaylist;

export interface SoundCloudSearchResponse {
  collection: SoundCloudSearchItem[];
  next_href?: string;
  query_urn?: string;
  // Add other search response properties as needed
}
