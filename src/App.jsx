import { useRef, useEffect, useState, useCallback } from "react";

function App() {
  const videoRef = useRef(null);
  const websocketRef = useRef(null);
  const streamingIntervalRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [frameRate, setFrameRate] = useState(10); // Adjustable frame rate

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing the camera:", error);
      }
    };

    startCamera();

    websocketRef.current = new WebSocket("ws://127.0.0.1:8000/video");

    websocketRef.current.onopen = () => console.log("WebSocket connected");
    websocketRef.current.onclose = (event) => console.warn("WebSocket closed", event);
    websocketRef.current.onerror = (error) => console.error("WebSocket error", error);

    return () => {
      if (websocketRef.current) websocketRef.current.close();
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  const startStreaming = useCallback(() => {
    if (
      !videoRef.current ||
      !websocketRef.current ||
      websocketRef.current.readyState !== WebSocket.OPEN
    )
      return;

    if (isStreaming) {
      console.log("Streaming is already running");
      return;
    }

    setIsStreaming(true);
    streamingIntervalRef.current = setInterval(() => {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const context = canvas.getContext("2d");
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob && websocketRef.current.readyState === WebSocket.OPEN) {
          websocketRef.current.send(blob);
        }
      }, "image/jpeg");
    }, 1000 / frameRate);
  }, [isStreaming, frameRate]);

  const stopStreaming = useCallback(() => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    setIsStreaming(false);
    console.log("Streaming stopped");
  }, []);

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", maxWidth: "600px" }}
      ></video>
      <div>
        <button onClick={startStreaming} disabled={isStreaming}>
          Start Streaming
        </button>
        <button onClick={stopStreaming} disabled={!isStreaming}>
          Stop Streaming
        </button>
      </div>
      <div>
        <label>
          Frame Rate:
          <input
            type="number"
            value={frameRate}
            onChange={(e) => setFrameRate(Number(e.target.value))}
            min="1"
            max="60"
          />
        </label>
      </div>
    </div>
  );
}

export default App;
