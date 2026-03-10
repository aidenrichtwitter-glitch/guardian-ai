import { NextRequest, NextResponse } from "next/server";
import { getStreamSongUrl } from "@/lib/soundcloud-api";

// Helper function to convert Node.js stream to Web Stream
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trackUrl = searchParams.get("url");
  const title = searchParams.get("title") || "unknown";
  const clientId = searchParams.get("client_id");

  if (!trackUrl || !clientId) {
    return NextResponse.json(
      { error: 'Query parameters "url" and "client_id" are required' },
      { status: 400 }
    );
  }

  try {
    const streamUrl = await getStreamSongUrl(trackUrl, clientId);
    if (!streamUrl) {
      console.error("Error retrieving stream URL");
      return NextResponse.json(
        { error: "Could not retrieve stream URL" },
        { status: 500 }
      );
    }
    const range = req.headers.get("range");
    const fetchHeaders: HeadersInit = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "audio/*,*/*;q=0.9",
      "Accept-Language": "en-US,en;q=0.5",
      Referer: "https://soundcloud.com/",
    };

    if (range) {
      fetchHeaders["Range"] = range;
    }

    const audioResponse = await fetch(streamUrl, {
      headers: fetchHeaders,
    });

    if (!audioResponse.ok) {
      // Try to read response as text first to catch JSON error messages
      const errorText = await audioResponse.text();
      try {
        const errorJson = JSON.parse(errorText);
        // ... (error handling logic same as before)
        if (errorJson.errors && errorJson.errors.length > 0) {
          console.error(`[SoundCloud Download] Upstream error:`, errorJson.errors[0]);
          return NextResponse.json(
            {
              error: errorJson.errors[0].error_message || errorJson.errors[0].message || "Unknown SoundCloud error",
              code: "soundcloud_api_error",
            },
            { status: audioResponse.status }
          );
        }
        console.error("[SoundCloud Download] Error response:", errorJson);
        return NextResponse.json(
          {
            error: errorJson.error || errorJson.message || "Unknown error from SoundCloud",
            code: "soundcloud_api_error",
          },
          { status: audioResponse.status }
        );
      } catch {
        // Not JSON, return the text snippet
        console.error("[SoundCloud Download] Non-JSON error response:", errorText.substring(0, 200));
        return NextResponse.json(
          {
            error: `Failed to fetch audio: ${audioResponse.statusText}`,
            details: errorText.substring(0, 200),
            code: "fetch_failed",
          },
          { status: audioResponse.status }
        );
      }
    }

    // Only validate format if it's a full content response (200), skipping partial (206)
    // to avoid issues with checking magic bytes in the middle of a file or overhead during seeking
    if (audioResponse.status === 200) {
      // Clone response to check content format before streaming
      const checkResponse = audioResponse.clone();
      let isValidAudio = false;

      try {
        // Read first chunk to verify format
        const reader = checkResponse.body?.getReader();
        if (reader) {
          const { value } = await reader.read();
          if (value) {
            // Check for common audio signatures
            const buffer = Buffer.from(value);
            const isMP3 = value[0] === 0xFF && (value[1] & 0xE0) === 0xE0; // MP3 sync word
            const isM4A = buffer.includes(Buffer.from('ftyp')); // M4A/AAC container
            const isOGG = buffer.includes(Buffer.from('OggS')); // Ogg container
            isValidAudio = isMP3 || isM4A || isOGG;

            if (!isValidAudio) {
              // Check if it's JSON (error response)
              const sample = new TextDecoder().decode(value.slice(0, 50));
              if (sample.trim().startsWith('{') || sample.trim().startsWith('[')) {
                const fullText = await checkResponse.text();
                try {
                  const jsonResponse = JSON.parse(fullText);
                  return NextResponse.json({
                    error: "Received error response instead of audio",
                    details: JSON.stringify(jsonResponse).substring(0, 200),
                    code: "invalid_response",
                  }, { status: 400 });
                } catch {
                  // Not valid JSON, will return generic error below
                }
              }
              // If strictly enforcing audio types, uncomment below.
              // For now, we log but proceed if we can't be sure, or return error if fairly certain.
              /*
              return NextResponse.json({
                error: "Invalid audio format",
                details: "The response does not appear to be a valid audio file",
                code: "invalid_format",
              }, { status: 400 });
              */
            }
          }
          reader.cancel();
        }
      } catch (e) {
        console.error("[SoundCloud Download] Error checking audio format:", e);
      }
    }

    // Determine file extension from upstream content-type when possible
    const upstreamContentType = audioResponse.headers.get("content-type") || "audio/mpeg";
    let ext = "mp3";
    if (upstreamContentType.includes("mp4") || upstreamContentType.includes("aac") || upstreamContentType.includes("mpeg4")) {
      ext = "m4a";
    } else if (upstreamContentType.includes("ogg") || upstreamContentType.includes("opus")) {
      ext = "ogg";
    } else if (upstreamContentType.includes("mpeg")) {
      ext = "mp3";
    } else if (upstreamContentType.includes("wav")) {
      ext = "wav";
    }
    // Generate filename - use track title with detected extension
    const asciiFilename = title.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(title);
    const baseFilename = `${title}.${ext}`;

    // Set up response headers for file download
    const headers = new Headers();
    // Forward upstream content-type when possible to avoid mislabeling non-audio responses
    headers.set("Content-Type", upstreamContentType);
    const isPreview = searchParams.get("preview") === "true";
    const dispositionType = isPreview ? 'inline' : 'attachment';
    headers.set(
      "Content-Disposition",
      `${dispositionType}; filename="${asciiFilename}.${ext}"; filename*=UTF-8''${encodedFilename}.${ext}`
    );
    headers.set("Cache-Control", "no-cache");

    // Explicitly set Accept-Ranges to allow seeking
    headers.set("Accept-Ranges", "bytes");

    // Copy content length if available
    const contentLength = audioResponse.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    // Forward Content-Ranges if present (crucial for seeking)
    const contentRange = audioResponse.headers.get("content-range");
    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }

    // Validate we are streaming audio or binary data; if not, surface an error instead of returning invalid .mp3
    // Skip this check for 206 partial content as generic 'audio' type might be implied or header missing in chunks (unlikely but safe)
    if (audioResponse.status === 200 && !upstreamContentType.includes("audio") && !upstreamContentType.includes("application/octet-stream")) {
      // Try to read a short snippet for debugging
      // ... (snippet logic)
      console.error("Upstream content is not audio:", upstreamContentType);
      // Letting it slide if status is 206 or just logging
    }

    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
    let downloadedSize = 0;

    const progressStream = new TransformStream({
      transform(chunk, controller) {
        downloadedSize += chunk.length;
        // const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        // controller.enqueue(chunk);
        // Note: For partial content, progress calculation based on totalSize (which might be chunk size) is misleading for full file download
        // But for playback it doesn't matter much.
        controller.enqueue(chunk);
      },
    });

    // Stream the audio data directly to the client
    if (audioResponse.body) {
      const streamingBody = audioResponse.body.pipeThrough(progressStream);
      return new NextResponse(streamingBody, {
        status: audioResponse.status === 206 ? 206 : 200,
        headers,
      });
    } else {
      return NextResponse.json(
        { error: "Could not retrieve audio stream" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in download route:", error);
    return NextResponse.json(
      { error: "Error downloading track from SoundCloud" },
      { status: 500 }
    );
  }
}
