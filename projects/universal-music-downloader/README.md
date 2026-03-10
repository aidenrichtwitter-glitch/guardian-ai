# Universal Music Downloader

This is a comprehensive web application built with Next.js that allows users to download songs and playlists from SoundCloud and YouTube.

## Features

*   **Multi-Platform Support:** Download from SoundCloud and YouTube.
*   **Download Single Tracks:** Enter a track URL to download the song in MP3 format.
*   **Download Playlists:** Enter a playlist URL to download all songs in the playlist.
*   **Responsive Design:** Optimized for both desktop and mobile devices.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later)
*   [Bun](https://bun.sh/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/soundcloud-downloader.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd soundcloud-downloader
    ```
3.  Install the dependencies using Bun:
    ```bash
    bun install
    ```
4.  Run the development server:
    ```bash
    bun dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1.  Open the application in your browser.
2.  Paste a SoundCloud or YouTube URL.
3.  Choose an output format (MP3/WAV/FLAC).
4.  Click "Go" to load the track/playlist, then download.

## API Endpoints

The application uses the following API endpoints:

*   `/api/soundcloud/get-client-id`: Retrieves the SoundCloud client ID required for making API requests.
*   `/api/soundcloud/song?url={song-url}`: Retrieves information about a single SoundCloud track.
*   `/api/soundcloud/playlist?url={playlist-url}`: Retrieves information about a SoundCloud playlist.
*   `/api/soundcloud/download?url={download-url}`: Downloads the song from the provided download URL.
*   `/api/youtube/info`: Retrieves info for a YouTube video or playlist (POST).
*   `/api/youtube/download?url={video-url}`: Streams best audio for a YouTube video (client converts via FFmpeg.wasm).

## Technologies Used

*   [Next.js](https://nextjs.org/) - React framework for building server-side rendered and static web applications.
*   [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript.
*   [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework.
*   [Bun](https://bun.sh/) - Fast JavaScript all-in-one toolkit.
*   [SoundCloud API](https://developers.soundcloud.com/) - Used for fetching song and playlist information.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Project Analysis and Feature Proposals

<details>
<summary>Click to expand</summary>

### 1. Project Analysis

#### Strengths

*   **Solid Foundation:** The project is built on a modern and robust tech stack, including Next.js, TypeScript, and Tailwind CSS. This provides a solid foundation for future development and scalability.
*   **Clear and Intuitive UI:** The user interface is clean, simple, and easy to use. The tab-based navigation makes it easy for users to switch between different download options.
*   **Good Separation of Concerns:** The use of API routes for handling backend logic ensures a good separation of concerns between the frontend and backend.
*   **Core Logic:** The project is well-structured and easy to maintain.

#### Weaknesses

*   **Limited Platform Support:** The application is limited to downloading from SoundCloud and YouTube. This limits its utility for users who use other platforms.
*   **No User Accounts or History:** There is no way for users to create accounts or save their download history. This makes it difficult for users to keep track of their downloads and access them later.
*   **One-off Downloads:** The application only supports one-off downloads. There is no way for users to queue multiple downloads or manage them in a central location.
*   **Basic Search Functionality:** The search functionality is basic and does not include any filters or sorting options. This makes it difficult for users to find the specific songs they are looking for.

#### Opportunities

*   **Expand to Other Platforms:** There is an opportunity to expand the application to support other platforms like Spotify, Apple Music, and Bandcamp.
*   **Introduce User Accounts:** Introducing user accounts would allow for a more personalized experience, including download history, playlists, and preferences.
*   **Implement a Download Queue:** A download queue would improve the user experience for bulk downloads and allow users to manage their downloads more effectively.
*   **Enhance Search Functionality:** Enhancing the search functionality with filters and sorting options would make it easier for users to find the songs they are looking for.

### 2. New Feature Proposals

Here is a list of 5-10 new features that could be added to the project to improve its functionality and user experience.

#### 1. User Accounts and History

*   **Description:** Allow users to create accounts to save their download history and preferences.
*   **Benefits:** A more personalized experience, repeat usage, and the potential for future monetization.
*   **Integration:** This would require adding a new "Profile" page and a database to store user data.
*   **Difficulty:** High
*   **Technologies:** NextAuth.js, MongoDB/PostgreSQL

#### 2. Download Queue and Management

*   **Description:** Allow users to queue multiple downloads and manage them in a central location.
*   **Benefits:** An improved user experience for bulk downloads.
*   **Integration:** This would require adding a "Downloads" page and a queueing system.
*   **Difficulty:** Medium
*   **Technologies:** Redis, BullMQ

#### 3. Support for More Platforms

*   **Description:** Add support for downloading from other platforms like Spotify and Apple Music.
*   **Benefits:** A wider audience and increased utility.
*   **Integration:** This would require adding new API routes for each platform.
*   **Difficulty:** High
*   **Technologies:** Spotify API, Apple Music API

#### 4. Enhanced Search with Filters and Sorting

*   **Description:** Allow users to filter search results by duration, genre, and upload date, and sort by relevance, popularity, and date.
*   **Benefits:** An improved search experience.
*   **Integration:** This would require adding filters and sorting options to the search UI.
*   **Difficulty:** Medium
*   **Technologies:** SoundCloud API

#### 5. Audio Format Conversion

*   **Description:** Allow users to choose the audio format for their downloads (e.g., MP3, FLAC, WAV).
*   **Benefits:** Increased flexibility for users.
*   **Integration:** This would require adding a format selection dropdown to the download UI.
*   **Difficulty:** Medium
*   **Technologies:** fluent-ffmpeg

#### 6. Dark Mode

*   **Description:** Add a dark mode option for the UI.
*   **Benefits:** An improved user experience in low-light environments.
*   **Integration:** This would require adding a theme switcher to the UI.
*   **Difficulty:** Low
*   **Technologies:** next-themes

#### 7. Social Sharing

*   **Description:** Allow users to share their downloaded songs on social media.
*   **Benefits:** Increased brand visibility and user acquisition.
*   **Integration:** This would require adding social sharing buttons to the download UI.
*   **Difficulty:** Low
*   **Technologies:** react-share

#### 8. Donation/Patreon Integration

*   **Description:** Add a way for users to support the project through donations or Patreon.
*   **Benefits:** Monetization.
*   **Integration:** This would require adding a donation button to the UI.
*   **Difficulty:** Low
*   **Technologies:** Stripe, Patreon API

#### 9. Lyrics Integration

*   **Description:** Display lyrics for the downloaded songs.
*   **Benefits:** An enhanced user experience.
*   **Integration:** This would require adding a lyrics section to the song page.
*   **Difficulty:** Medium
*   **Technologies:** Musixmatch API, Genius API

#### 10. Playlist Creation

*   **Description:** Allow users to create and save their own playlists.
*   **Benefits:** Increased user engagement and retention.
*   **Integration:** This would require adding a "Playlists" page and a database to store playlist data.
*   **Difficulty:** High
*   **Technologies:** MongoDB/PostgreSQL

### 3. Prioritization

Here is a prioritized list of the new features based on their potential impact and feasibility.

1.  **Dark Mode:** Low hanging fruit that will improve the user experience.
2.  **Audio Format Conversion:** A high-value feature that is relatively easy to implement.
3.  **Enhanced Search with Filters and Sorting:** A high-value feature that will significantly improve the user experience.
4.  **Download Queue and Management:** A high-value feature that will make the application more powerful and user-friendly.
5.  **User Accounts and History:** A high-value feature that will provide a more personalized experience and unlock future monetization opportunities.

### 4. Testing Plan

Here is a plan for testing the new features to ensure that they are working correctly and that they do not introduce any regressions.

*   **Unit Tests:** Write unit tests for all new API routes and components.
*   **Integration Tests:** Write integration tests to ensure that the new features work together as expected.
*   **End-to-End Tests:** Write end-to-end tests to simulate user workflows and catch any regressions.
*   **A/B Testing:** Use A/B testing to compare the effectiveness of different feature variations.
*   **User Feedback:** Collect user feedback through surveys and feedback forms to identify any issues and areas for improvement.

</details>
