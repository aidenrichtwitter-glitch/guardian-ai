import { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AudioVisualizer } from "./AudioVisualizer";
import { LiveAudioVisualizer } from "./LiveAudioVisualizer";

function App() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [tab, setTab] = useState<"file" | "live">("file");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBlob(file);
    setCurrentTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
    const audio = new Audio(URL.createObjectURL(file));
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("ended", () => setIsPlaying(false));
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    };
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto", padding: 32 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>React Audio Visualize</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        Audio visualization components for React — load a file or use your mic.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setTab("file")}
          style={{
            padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer",
            background: tab === "file" ? "#4f8cff" : "#333", color: "#fff", fontWeight: 600,
          }}
        >
          File Visualizer
        </button>
        <button
          onClick={() => setTab("live")}
          style={{
            padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer",
            background: tab === "live" ? "#4f8cff" : "#333", color: "#fff", fontWeight: 600,
          }}
        >
          Live Mic Visualizer
        </button>
      </div>

      {tab === "file" && (
        <div>
          <label
            style={{
              display: "inline-block", padding: "10px 24px", borderRadius: 8,
              background: "#4f8cff", color: "#fff", cursor: "pointer", fontWeight: 600, marginBottom: 16,
            }}
          >
            Choose Audio File
            <input type="file" accept="audio/*" onChange={handleFileChange} style={{ display: "none" }} />
          </label>
          {fileName && <span style={{ marginLeft: 12, color: "#aaa" }}>{fileName}</span>}

          {blob && (
            <div style={{ marginTop: 16 }}>
              <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <AudioVisualizer
                  blob={blob}
                  width={700}
                  height={75}
                  barWidth={3}
                  gap={2}
                  barColor="#4f8cff"
                  barPlayedColor="#ff6b6b"
                  currentTime={currentTime}
                  style={{ borderRadius: 8 }}
                />
              </div>
              <button
                onClick={togglePlay}
                style={{
                  padding: "8px 28px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: isPlaying ? "#ff6b6b" : "#4f8cff", color: "#fff", fontWeight: 600, fontSize: 16,
                }}
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "live" && (
        <div>
          {!isRecording ? (
            <button
              onClick={startRecording}
              style={{
                padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "#ff6b6b", color: "#fff", fontWeight: 600, fontSize: 16,
              }}
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{
                padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "#555", color: "#fff", fontWeight: 600, fontSize: 16,
              }}
            >
              Stop Recording
            </button>
          )}

          {mediaRecorder && (
            <div style={{ marginTop: 16, background: "#1a1a2e", borderRadius: 12, padding: 16 }}>
              <LiveAudioVisualizer
                mediaRecorder={mediaRecorder}
                width={700}
                height={100}
                barWidth={3}
                gap={2}
                barColor="#4f8cff"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
