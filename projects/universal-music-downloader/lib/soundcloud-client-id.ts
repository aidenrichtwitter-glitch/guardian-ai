import "server-only";

import { unstable_cache } from "next/cache";
import { scrapeClientId } from "@/lib/scapper-client-id";

export const getSoundCloudClientId = unstable_cache(
  async (): Promise<string | null> => {
    return scrapeClientId();
  },
  ["soundcloud-client-id"],
  {
    revalidate: 24 * 60 * 60, // 24 hours
    tags: ["soundcloud-client-id"],
  }
);

