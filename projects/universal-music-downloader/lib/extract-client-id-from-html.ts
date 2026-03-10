const CLIENT_ID_PATTERNS = [
  /"client_id":"([a-zA-Z0-9]{32})"/g,
  /client_id=([a-zA-Z0-9]{32})/g,
  /client_id:"([a-zA-Z0-9]{32})"/g,
  /"client_id":\s*"([a-zA-Z0-9]{32})"/g,
  /clientId:\s*"([a-zA-Z0-9]{32})"/g,
  /clientId:"([a-zA-Z0-9]{32})"/g,
  /"clientId":"([a-zA-Z0-9]{32})"/g,
  /,clientId:"([a-zA-Z0-9]{32})"/g,
  /window\.__sc_hydration\s*=\s*\[{[^}]*"client_id":"([a-zA-Z0-9]{32})"/g,
  /=[a-zA-Z0-9]{2},"client_id":"([a-zA-Z0-9]{32})"/g,
  /client_id\s*:\s*'([a-zA-Z0-9]{32})'/g,
  /client_id\s*=\s*'([a-zA-Z0-9]{32})'/g,
];

export function extractClientIdFromHtml(html: string): string | null {
  // Try to find client ID using multiple patterns
  for (const pattern of CLIENT_ID_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    const matches = Array.from(html.matchAll(pattern));

    if (matches.length > 0) {
      // Get the most common client ID (in case there are multiple)
      const clientIds = matches.map((match) => match[1]);
      const clientIdCounts = clientIds.reduce(
        (acc: Record<string, number>, id) => {
          if (id && id.length === 32) {
            // Ensure it's 32 characters
            acc[id] = (acc[id] || 0) + 1;
          }
          return acc;
        },
        {}
      );

      const validClientIds = Object.entries(clientIdCounts)
        .filter(([id]) => /^[a-zA-Z0-9]{32}$/.test(id))
        .sort(([, a], [, b]) => b - a);

      if (validClientIds.length > 0) {
        return validClientIds[0][0];
      }
    }
  }

  return null;
}

export async function extractClientIdFromScripts(html: string): Promise<string | null> {
  const scriptUrls = Array.from(html.matchAll(/<script.*?src="(.*?)"/g)).map(match => match[1]);

  if (!scriptUrls) {
    console.log("No script URLs found in the HTML.");
    return null;
  }

  console.log(`Found ${scriptUrls.length} script URLs.`);

  for (const url of scriptUrls) {
    // Check if client ID is in the script URL itself
    const clientIdInUrl = url.match(/client_id=([a-zA-Z0-9]{32})/)?.[1];
    if (clientIdInUrl) {
      console.log(`Found client ID in script URL ${url}: ${clientIdInUrl.substring(0, 8)}...`);
      return clientIdInUrl;
    }

    console.log(`Fetching script: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`Failed to fetch script ${url}: ${response.status}`);
        continue;
      }
      const scriptContent = await response.text();
      const clientId = extractClientIdFromHtml(scriptContent);
      if (clientId) {
        console.log(`Found client ID in script ${url}: ${clientId.substring(0, 8)}...`);
        return clientId;
      }
    } catch (error) {
      console.error(`Error fetching script ${url}:`, error);
    }
  }

  console.log("No client ID found in any of the scripts.");
  return null;
}
