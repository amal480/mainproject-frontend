import { useRef, useEffect, useState, useCallback } from "react";
import './App.css';

function App() {
  const videoRef = useRef(null);
  const websocketRef = useRef(null); // For video WebSocket
  const audioWebSocketRef = useRef(null); // For audio WebSocket
  const streamingIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null); // For Web Audio API
  const mediaStreamRef = useRef(null); // Ref for media stream
  const audioSourceRef = useRef(null); // Ref for audio source
  const audioProcessorRef = useRef(null); // For audio processing

  const [isStreaming, setIsStreaming] = useState(false);
  const [frameRate, setFrameRate] = useState(10); // Adjustable frame rate
  const [detectionData, setDetectionData] = useState({
    cell_phone_boxes: [],
    head_direction: "Unknown",
    people_count: 0,
  });
  const [speechStatus, setSpeechStatus] = useState("No speech detected");
  const [websocketStatus, setWebsocketStatus] = useState({
    video: "disconnected",
    audio: "disconnected"
  });

  // Setup WebSockets with reconnection logic
  useEffect(() => {
    const setupWebSockets = () => {
      // Video WebSocket setup
      if (!websocketRef.current || websocketRef.current.readyState === WebSocket.CLOSED) {
        websocketRef.current = new WebSocket("ws://127.0.0.1:8000/video");
        
        websocketRef.current.onopen = () => {
          console.log("Video WebSocket connected");
          setWebsocketStatus(prev => ({ ...prev, video: "connected" }));
        };
        
        websocketRef.current.onclose = (event) => {
          console.warn("Video WebSocket closed", event);
          setWebsocketStatus(prev => ({ ...prev, video: "disconnected" }));
          // Attempt to reconnect after 2 seconds
          setTimeout(setupWebSockets, 2000);
        };
        
        websocketRef.current.onerror = (error) => {
          console.error("Video WebSocket error", error);
          setWebsocketStatus(prev => ({ ...prev, video: "error" }));
        };
        
        websocketRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.cell_phone_boxes !== undefined) {
              setDetectionData(data);
            }
          } catch (error) {
            console.error("Error parsing video WebSocket message:", error);
          }
        };
      }

      // Audio WebSocket setup
      if (!audioWebSocketRef.current || audioWebSocketRef.current.readyState === WebSocket.CLOSED) {
        audioWebSocketRef.current = new WebSocket("ws://127.0.0.1:8000/audio");
        
        audioWebSocketRef.current.onopen = () => {
          console.log("Audio WebSocket connected");
          setWebsocketStatus(prev => ({ ...prev, audio: "connected" }));
        };
        
        audioWebSocketRef.current.onclose = (event) => {
          console.warn("Audio WebSocket closed", event);
          setWebsocketStatus(prev => ({ ...prev, audio: "disconnected" }));
          // Attempt to reconnect after 2 seconds
          setTimeout(setupWebSockets, 2000);
        };
        
        audioWebSocketRef.current.onerror = (error) => {
          console.error("Audio WebSocket error", error);
          setWebsocketStatus(prev => ({ ...prev, audio: "error" }));
        };
        
        audioWebSocketRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "speech_detection") {
              console.log("Speech detection update:", data.status);
              setSpeechStatus(data.status);
            }
          } catch (error) {
            console.error("Error parsing audio WebSocket message:", error);
          }
        };
      }
    };

    setupWebSockets();

    return () => {
      cleanupResources();
    };
  }, []);

  // Clean up all resources
  const cleanupResources = () => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.close();
    }
    
    if (audioWebSocketRef.current && audioWebSocketRef.current.readyState === WebSocket.OPEN) {
      audioWebSocketRef.current.close();
    }
    
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
    }
    
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  // Start media stream with both video and audio
  const startMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  };

  // Set up modern audio processing pipeline
  const startAudioProcessing = async (stream) => {
    try {
      // Create AudioContext with proper sample rate
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ 
        sampleRate: 16000 
      });

      await audioContextRef.current.audioWorklet.addModule(
        URL.createObjectURL(new Blob([`
          class AudioProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this.bufferSize = 4096;
              this.buffer = new Float32Array(this.bufferSize);
              this.bufferIndex = 0;
            }
            
            process(inputs, outputs, parameters) {
              const input = inputs[0][0];
              
              if (!input) return true;
              
              // Copy input data to our buffer
              for (let i = 0; i < input.length; i++) {
                this.buffer[this.bufferIndex++] = input[i];
                
                // When buffer is full, send it to main thread
                if (this.bufferIndex >= this.bufferSize) {
                  this.port.postMessage({
                    audioData: this.buffer.slice(0)
                  });
                  this.bufferIndex = 0;
                }
              }
              
              return true;
            }
          }
          
          registerProcessor('audio-processor', AudioProcessor);
        `], { type: 'application/javascript' }))
      );

      // Create audio source from stream
      const source = audioContextRef.current.createMediaStreamSource(stream);
      audioSourceRef.current = source;

      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      audioProcessorRef.current = workletNode;
      
      // Connect nodes
      source.connect(workletNode);
      
      // Set up message handler to receive audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (!isStreaming || 
            !audioWebSocketRef.current || 
            audioWebSocketRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const { audioData } = event.data;
        
        // Convert float audio data to Int16 for sending
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          // Clamp audio data to [-1, 1] range
          const sample = Math.max(-1, Math.min(1, audioData[i]));
          // Convert to Int16 range
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        try {
          // Send binary audio data through WebSocket
          audioWebSocketRef.current.send(pcmData.buffer);
        } catch (error) {
          console.error("Error sending audio data:", error);
        }
      };

      console.log("Audio processing started successfully with AudioWorklet");
    } catch (error) {
      console.error("Error in audio processing setup:", error);
      // Fallback to older audio processing method if AudioWorklet is not supported
      startLegacyAudioProcessing(stream);
    }
  };

  // Fallback audio processing method using ScriptProcessor (deprecated but more widely supported)
  const startLegacyAudioProcessing = (stream) => {
    try {
      console.log("Falling back to ScriptProcessor for audio");
      
      // Create or resume AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ 
          sampleRate: 16000 
        });
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Create audio source from stream
      const source = audioContextRef.current.createMediaStreamSource(stream);
      audioSourceRef.current = source;
      
      // Create processor node with buffer size that's a power of 2
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;
      
      // Connect nodes
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      // Process audio data
      processor.onaudioprocess = (e) => {
        if (!isStreaming || 
            !audioWebSocketRef.current || 
            audioWebSocketRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        try {
          audioWebSocketRef.current.send(pcmData.buffer);
        } catch (error) {
          console.error("Error sending audio data:", error);
        }
      };

      console.log("Legacy audio processing started successfully");
    } catch (error) {
      console.error("Error in legacy audio processing setup:", error);
      throw error;
    }
  };

  const startStreaming = useCallback(async () => {
    try {
      // Check WebSocket connections
      if ((!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) ||
          (!audioWebSocketRef.current || audioWebSocketRef.current.readyState !== WebSocket.OPEN)) {
        console.error("WebSockets not ready. Current status:", websocketStatus);
        alert("Connection to server not established. Please try again in a moment.");
        return;
      }

      if (isStreaming) {
        console.log("Already streaming");
        return;
      }

      // Start media stream
      const stream = await startMediaStream();
      
      // Start audio processing
      await startAudioProcessing(stream);

      setIsStreaming(true);
      
      // Start video frame sending
      streamingIntervalRef.current = setInterval(() => {
        const canvas = document.createElement("canvas");
        const video = videoRef.current;
        
        if (!video || !video.videoWidth) {
          return; // Skip if video dimensions aren't available yet
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob && websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(blob);
          }
        }, "image/jpeg", 0.8); // Specify quality for better performance
      }, 1000 / frameRate);

    } catch (error) {
      console.error("Error starting streaming:", error);
      setIsStreaming(false);
      alert(`Error starting stream: ${error.message}`);
    }
  }, [isStreaming, frameRate, websocketStatus]);

  const stopStreaming = useCallback(() => {
    try {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }

      // Stop audio processing
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }

      // Stop media streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.suspend(); // Just suspend, don't close completely
      }

      setIsStreaming(false);
      console.log("Streaming stopped successfully");
    } catch (error) {
      console.error("Error stopping streaming:", error);
    }
  }, []);

  // Periodically draw detections on the canvas overlay
  useEffect(() => {
    const drawDetections = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video && video.videoWidth && detectionData) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the current video frame as background
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw bounding boxes for detected cell phones
        detectionData.cell_phone_boxes.forEach((box) => {
          context.strokeStyle = "#FF00FF"; // Pink color
          context.lineWidth = 3;
          context.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
          context.font = "18px Arial";
          context.fillStyle = "#00FF00"; // Green color
          context.fillText("Cell Phone", box.x1, box.y1 - 10);
        });

        // Draw head direction and people count
        context.font = "24px Arial";
        context.fillStyle = "#FFFFFF"; // White color
        context.fillText(`Head Direction: ${detectionData.head_direction}`, 20, canvas.height - 50);
        context.fillText(`People Count: ${detectionData.people_count}`, 20, canvas.height - 20);
      }
    };

    const interval = setInterval(drawDetections, 1000 / frameRate);
    return () => clearInterval(interval);
  }, [detectionData, frameRate]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Online Exam Proctoring System</h1>
      </header>
      <main className="app-main">
        <div className="video-container">
          <video ref={videoRef} autoPlay playsInline className="hidden-video"></video>
          <canvas ref={canvasRef} className="video-canvas"></canvas>
        </div>
        <div className="controls">
          <button onClick={startStreaming} disabled={isStreaming} className="control-button start-button">
            Start Proctoring
          </button>
          <button onClick={stopStreaming} disabled={!isStreaming} className="control-button stop-button">
            Stop Proctoring
          </button>
          <div className="frame-rate-control">
            <label htmlFor="frameRate">Frame Rate:</label>
            <input
              id="frameRate"
              type="number"
              value={frameRate}
              onChange={(e) => setFrameRate(Number(e.target.value))}
              min="1"
              max="60"
              className="frame-rate-input"
            />
          </div>
        </div>
        <div className="detection-info">
          <h2>Proctoring Details</h2>
          <div className="info-item">
            <strong>Head Direction:</strong> {detectionData.head_direction}
          </div>
          <div className="info-item">
            <strong>Number of People Detected:</strong> {detectionData.people_count}
          </div>
          <div className="info-item">
            <strong>Detected Devices:</strong> {detectionData.cell_phone_boxes.length}
          </div>
          <div className="info-item speech-status">
            <strong>Speech Status:</strong> <span className={`status-text ${speechStatus.includes("detected") ? "active" : ""}`}>{speechStatus}</span>
          </div>
          <div className="info-item">
            <strong>Connection Status:</strong> 
            <span className={`status-text ${websocketStatus.video === "connected" ? "active" : "inactive"}`}>
              Video: {websocketStatus.video}
            </span>, 
            <span className={`status-text ${websocketStatus.audio === "connected" ? "active" : "inactive"}`}>
              Audio: {websocketStatus.audio}
            </span>
          </div>
        </div>
        <div className="exam-status">
          <div className={`status-indicator ${isStreaming ? "active" : "inactive"}`}>
            {isStreaming ? "Proctoring Active" : "Proctoring Inactive"}
          </div>
        </div>
      </main>
      <footer className="app-footer">
        <p>&copy; 2025 Your Company Name. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;