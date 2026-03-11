import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 32, textAlign: "center" }}>
      <h1>Project Ready</h1>
      <p>Edit <code>src/main.tsx</code> to get started.</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
