import { useMemo } from "react";

export type ServiceType = "soundcloud" | "youtube" | "unknown";
export type SearchMode = "single" | "playlist";

export interface DetectionResult {
  service: ServiceType;
  mode: SearchMode;
  isValid: boolean;
  isUrl: boolean;
}

export function useServiceDetection(input: string): DetectionResult {
  return useMemo(() => {
    if (!input.trim()) {
      return {
        service: "unknown",
        mode: "single",
        isValid: false,
        isUrl: false,
      };
    }

    const lowerInput = input.toLowerCase();
    const isUrl = /^https?:\/\//i.test(input.trim());

    // URL-only: detect supported services
    let service: ServiceType = "unknown";
    if (isUrl) {
      if (lowerInput.includes("youtube.com") || lowerInput.includes("youtu.be")) {
        service = "youtube";
      } else if (lowerInput.includes("soundcloud.com") || lowerInput.includes("on.soundcloud.com")) {
        service = "soundcloud";
      }
    }

    // Detect mode
    let mode: SearchMode = "single";
    if (isUrl) {
      if (
        lowerInput.includes("/sets/") ||
        lowerInput.includes("playlist?list=")
      ) {
        mode = "playlist";
      } else {
        mode = "single";
      }
    }

    return {
      service,
      mode,
      isValid: isUrl && service !== "unknown",
      isUrl,
    };
  }, [input]);
}
