import { extractClientIdFromHtml, extractClientIdFromScripts } from "@/lib/extract-client-id-from-html";

export async function scrapeClientId(): Promise<string | null> {
  try {
    console.log("Scraping SoundCloud client ID...");

    const response = await fetch("https://soundcloud.com/discover", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch SoundCloud: ${response.status}`);
      return null;
    }

    const html = await response.text();
    let clientId = extractClientIdFromHtml(html);

    if (clientId) {
      console.log(`Found client ID: ${clientId.substring(0, 8)}...`);
      return clientId;
    }

    clientId = await extractClientIdFromScripts(html);
    if (clientId) {
      console.log(`Found client ID from scripts: ${clientId.substring(0, 8)}...`);
      return clientId;
    }

    console.error("No client ID found.");
    return null;
  } catch (error) {
    console.error("Error scraping client ID:", error);
    return null;
  }
}
