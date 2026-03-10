import type { Metadata, Viewport } from "next";
import "./globals.css";

// Contexts & Components
import { ClientIdProvider } from "@/contexts/ClientIdProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/common/Header";
import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import dictionary from "@/lib/dictionary.json";
import { getSoundCloudClientId } from "@/lib/soundcloud-client-id";

// --- Constants & Types ---
const BASE_URL = "https://universal-music-downloader.vercel.app";

// --- Metadata ---
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dictionary.hero.title,
    description: dictionary.hero.description,
    keywords: "SoundCloud downloader, YouTube downloader, download music, MP3 downloader, playlist downloader",
    metadataBase: new URL(BASE_URL),
    openGraph: {
      title: dictionary.hero.title,
      description: dictionary.hero.description,
      url: `/`,
      type: "website",
      locale: "en_US",
      siteName: "Universal Music Downloader",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: dictionary.hero.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dictionary.hero.title,
      description: dictionary.hero.description,
      images: ["/og-image.png"],
    },
    alternates: {
      canonical: `/`,
    },
    icons: {
      icon: "/favicon.svg",
      apple: "/apple-touch-icon.png",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

// --- Helper: Server Side Fetch ---
async function fetchClientId(): Promise<string | null> {
  try {
    return await getSoundCloudClientId();
  } catch (error) {
    console.warn("Failed to fetch Client ID on server:", error);
    return null;
  }
}

// --- Root Layout ---
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Parallel Data Fetching (Dictionary is already cached, ClientID is new)
  const initialClientId = await fetchClientId();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ClientIdProvider initialClientId={initialClientId}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Header />
            {children}
            <ScrollToTopButton />
          </ThemeProvider>
        </ClientIdProvider>
      </body>
    </html>
  );
}
