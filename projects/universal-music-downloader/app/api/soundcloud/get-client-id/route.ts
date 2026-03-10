import { NextResponse } from "next/server";
import { getSoundCloudClientId } from "@/lib/soundcloud-client-id";

export async function GET() {
  try {
    const clientId = await getSoundCloudClientId();

    if (!clientId) {
      return NextResponse.json(
        { error: "Could not find client_id" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientId });
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching data from SoundCloud" },
      { status: 500 }
    );
  }
}
