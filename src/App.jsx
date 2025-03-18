// import { useRef, useEffect, useState, useCallback } from "react";
// import './App.css';

// function App() {
//   const videoRef = useRef(null);
//   const websocketRef = useRef(null); // For video WebSocket
//   const audioWebSocketRef = useRef(null); // For audio WebSocket
//   const streamingIntervalRef = useRef(null);
//   const canvasRef = useRef(null);
//   const audioContextRef = useRef(null); // For Web Audio API
//   const mediaStreamRef = useRef(null); // Ref for media stream
//   const audioSourceRef = useRef(null); // Ref for audio source
//   const audioWorkletRef = useRef(null); // For audio processing

//   const [isStreaming, setIsStreaming] = useState(false);
//   const [frameRate, setFrameRate] = useState(10); // Adjustable frame rate
//   const [detectionData, setDetectionData] = useState({
//     cell_phone_boxes: [],
//     head_direction: "Unknown",
//     people_count: 0,
//   });
//   const [speechStatus, setSpeechStatus] = useState(false);
//   const [websocketStatus, setWebsocketStatus] = useState({
//     video: "disconnected",
//     audio: "disconnected"
//   });

//   // Setup WebSockets with reconnection logic
//   useEffect(() => {
//     const setupWebSockets = () => {
//       // Video WebSocket setup
//       if (!websocketRef.current || websocketRef.current.readyState === WebSocket.CLOSED) {
//         websocketRef.current = new WebSocket("ws://127.0.0.1:8000/video");
        
//         websocketRef.current.onopen = () => {
//           console.log("Video WebSocket connected");
//           setWebsocketStatus(prev => ({ ...prev, video: "connected" }));
//         };
        
//         websocketRef.current.onclose = (event) => {
//           console.warn("Video WebSocket closed", event);
//           setWebsocketStatus(prev => ({ ...prev, video: "disconnected" }));
//           // Attempt to reconnect after 2 seconds
//           setTimeout(setupWebSockets, 2000);
//         };
        
//         websocketRef.current.onerror = (error) => {
//           console.error("Video WebSocket error", error);
//           setWebsocketStatus(prev => ({ ...prev, video: "error" }));
//         };
        
//         websocketRef.current.onmessage = (event) => {
//           try {
//             const data = JSON.parse(event.data);
//             if (data.cell_phone_boxes !== undefined) {
//               setDetectionData(data);
//             }
//           } catch (error) {
//             console.error("Error parsing video WebSocket message:", error);
//           }
//         };
//       }

//       // Audio WebSocket setup
//       if (!audioWebSocketRef.current || audioWebSocketRef.current.readyState === WebSocket.CLOSED) {
//         audioWebSocketRef.current = new WebSocket("ws://localhost:8001/audio");
        
//         audioWebSocketRef.current.onopen = () => {
//           console.log("Audio WebSocket connected");
//           setWebsocketStatus(prev => ({ ...prev, audio: "connected" }));
//         };
        
//         audioWebSocketRef.current.onclose = (event) => {
//           console.warn("Audio WebSocket closed", event);
//           setWebsocketStatus(prev => ({ ...prev, audio: "disconnected" }));
//           // Attempt to reconnect after 2 seconds
//           setTimeout(setupWebSockets, 2000);
//         };
        
//         audioWebSocketRef.current.onerror = (error) => {
//           console.error("Audio WebSocket error", error);
//           setWebsocketStatus(prev => ({ ...prev, audio: "error" }));
//         };
        
//         audioWebSocketRef.current.onmessage = (event) => {
//           try {
//             const response = JSON.parse(event.data);
//             setSpeechStatus(response.speech_timestamps.length > 0); // Update speech status
//             console.log("Speech detected:", response.speech_detected);
//             console.log("VAD Response:", response);
//           } catch (error) {
//             console.error("Error parsing audio WebSocket message:", error);
//           }
//         };
//       }
//     };

//     setupWebSockets();

//     return () => {
//       cleanupResources();
//     };
//   }, []);

//   // Clean up all resources
//   const cleanupResources = () => {
//     if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
//       websocketRef.current.close();
//     }
    
//     if (audioWebSocketRef.current && audioWebSocketRef.current.readyState === WebSocket.OPEN) {
//       audioWebSocketRef.current.close();
//     }
    
//     if (streamingIntervalRef.current) {
//       clearInterval(streamingIntervalRef.current);
//     }
    
//     if (mediaStreamRef.current) {
//       mediaStreamRef.current.getTracks().forEach(track => track.stop());
//     }
    
//     if (audioSourceRef.current) {
//       audioSourceRef.current.disconnect();
//     }
    
//     if (audioWorkletRef.current) {
//       audioWorkletRef.current.disconnect();
//     }
    
//     if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
//       audioContextRef.current.close();
//     }
//   };

//   // Start media stream with both video and audio
//   const startMediaStream = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { width: 1280, height: 720 },
//         audio: {
//           sampleRate: 16000,
//           sampleSize: 16,
//           channelCount: 1,
//           echoCancellation: true,
//           noiseSuppression: true,
//         }
//       });

//       mediaStreamRef.current = stream;
//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//       }

//       return stream;
//     } catch (error) {
//       console.error("Error accessing media devices:", error);
//       throw error;
//     }
//   };

//   // Set up modern audio processing pipeline using AudioWorklet
//   const startAudioProcessing = async (stream) => {
//     try {
//       // Create AudioContext with proper sample rate
//       audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ 
//         sampleRate: 16000 
//       });

//       // Load the AudioWorklet processor
//       await audioContextRef.current.audioWorklet.addModule('audio-processor.js');

//       // Create audio source from stream
//       const source = audioContextRef.current.createMediaStreamSource(stream);
//       audioSourceRef.current = source;

//       // Create AudioWorkletNode
//       const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
//       audioWorkletRef.current = workletNode;

//       // Connect nodes
//       source.connect(workletNode);
//       workletNode.connect(audioContextRef.current.destination);

//       // Handle messages from the AudioWorklet processor
//       workletNode.port.onmessage = (event) => {
//         const { audioData } = event.data;

//         // Convert Float32 audio data to Int16 for sending
//         const pcmData = new Int16Array(audioData.length);
//         for (let i = 0; i < audioData.length; i++) {
//           const s = Math.max(-1, Math.min(1, audioData[i]));
//           pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
//         }

//         // Send binary audio data through WebSocket
//         if (audioWebSocketRef.current && audioWebSocketRef.current.readyState === WebSocket.OPEN) {
//           audioWebSocketRef.current.send(pcmData.buffer);
//         }
//       };

//       console.log("Audio processing started successfully with AudioWorklet");
//     } catch (error) {
//       console.error("Error in audio processing setup:", error);
//       throw error;
//     }
//   };

//   const startStreaming = useCallback(async () => {
//     try {
//       // Check WebSocket connections
//       if ((!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) ||
//           (!audioWebSocketRef.current || audioWebSocketRef.current.readyState !== WebSocket.OPEN)) {
//         console.error("WebSockets not ready. Current status:", websocketStatus);
//         alert("Connection to server not established. Please try again in a moment.");
//         return;
//       }

//       if (isStreaming) {
//         console.log("Already streaming");
//         return;
//       }

//       // Start media stream
//       const stream = await startMediaStream();
      
//       // Start audio processing
//       await startAudioProcessing(stream);

//       setIsStreaming(true);
      
//       // Start video frame sending
//       streamingIntervalRef.current = setInterval(() => {
//         const canvas = document.createElement("canvas");
//         const video = videoRef.current;
        
//         if (!video || !video.videoWidth) {
//           return; // Skip if video dimensions aren't available yet
//         }
        
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         const context = canvas.getContext("2d");
//         context.drawImage(video, 0, 0, canvas.width, canvas.height);

//         canvas.toBlob((blob) => {
//           if (blob && websocketRef.current?.readyState === WebSocket.OPEN) {
//             websocketRef.current.send(blob);
//           }
//         }, "image/jpeg", 0.8); // Specify quality for better performance
//       }, 1000 / frameRate);

//     } catch (error) {
//       console.error("Error starting streaming:", error);
//       setIsStreaming(false);
//       alert(`Error starting stream: ${error.message}`);
//     }
//   }, [isStreaming, frameRate, websocketStatus]);

//   const stopStreaming = useCallback(() => {
//     try {
//       if (streamingIntervalRef.current) {
//         clearInterval(streamingIntervalRef.current);
//         streamingIntervalRef.current = null;
//       }

//       // Stop audio processing
//       if (audioSourceRef.current) {
//         audioSourceRef.current.disconnect();
//         audioSourceRef.current = null;
//       }
      
//       if (audioWorkletRef.current) {
//         audioWorkletRef.current.disconnect();
//         audioWorkletRef.current = null;
//       }

//       // Stop media streams
//       if (mediaStreamRef.current) {
//         mediaStreamRef.current.getTracks().forEach(track => track.stop());
//         mediaStreamRef.current = null;
//       }

//       if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
//         audioContextRef.current.suspend(); // Just suspend, don't close completely
//       }

//       setIsStreaming(false);
//       console.log("Streaming stopped successfully");
//     } catch (error) {
//       console.error("Error stopping streaming:", error);
//     }
//   }, []);

//   // Periodically draw detections on the canvas overlay
//   useEffect(() => {
//     const drawDetections = () => {
//       const canvas = canvasRef.current;
//       const video = videoRef.current;

//       if (canvas && video && video.videoWidth && detectionData) {
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         const context = canvas.getContext("2d");
//         context.clearRect(0, 0, canvas.width, canvas.height);

//         // Draw the current video frame as background
//         context.drawImage(video, 0, 0, canvas.width, canvas.height);

//         // Draw bounding boxes for detected cell phones
//         detectionData.cell_phone_boxes.forEach((box) => {
//           context.strokeStyle = "#FF00FF"; // Pink color
//           context.lineWidth = 3;
//           context.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
//           context.font = "18px Arial";
//           context.fillStyle = "#00FF00"; // Green color
//           context.fillText("Cell Phone", box.x1, box.y1 - 10);
//         });

//         // Draw head direction and people count
//         context.font = "24px Arial";
//         context.fillStyle = "#FFFFFF"; // White color
//         context.fillText(`Head Direction: ${detectionData.head_direction}`, 20, canvas.height - 50);
//         context.fillText(`People Count: ${detectionData.people_count}`, 20, canvas.height - 20);
//       }
//     };

//     const interval = setInterval(drawDetections, 1000 / frameRate);
//     return () => clearInterval(interval);
//   }, [detectionData, frameRate]);

//   return (
//     <div className="app-container">
//       <header className="app-header">
//         <h1>Online Exam Proctoring System</h1>
//       </header>
//       <main className="app-main">
//         <div className="video-container">
//           <video ref={videoRef} autoPlay playsInline className="hidden-video"></video>
//           <canvas ref={canvasRef} className="video-canvas"></canvas>
//         </div>
//         <div className="controls">
//           <button onClick={startStreaming} disabled={isStreaming} className="control-button start-button">
//             Start Proctoring
//           </button>
//           <button onClick={stopStreaming} disabled={!isStreaming} className="control-button stop-button">
//             Stop Proctoring
//           </button>
//           <div className="frame-rate-control">
//             <label htmlFor="frameRate">Frame Rate:</label>
//             <input
//               id="frameRate"
//               type="number"
//               value={frameRate}
//               onChange={(e) => setFrameRate(Number(e.target.value))}
//               min="1"
//               max="60"
//               className="frame-rate-input"
//             />
//           </div>
//         </div>
//         <div className="detection-info">
//           <h2>Proctoring Details</h2>
//           <div className="info-item">
//             <strong>Head Direction:</strong> {detectionData.head_direction}
//           </div>
//           <div className="info-item">
//             <strong>Number of People Detected:</strong> {detectionData.people_count}
//           </div>
//           <div className="info-item">
//             <strong>Detected Devices:</strong> {detectionData.cell_phone_boxes.length}
//           </div>
//           <div style={{ marginTop: '20px' }}>
//             Speech Detected: {speechStatus ? '🗣️ Yes' : '❌ No'}
//           </div>
//           <div className="info-item">
//             <strong>Connection Status:</strong> 
//             <span className={`status-text ${websocketStatus.video === "connected" ? "active" : "inactive"}`}>
//               Video: {websocketStatus.video}
//             </span>, 
//             <span className={`status-text ${websocketStatus.audio === "connected" ? "active" : "inactive"}`}>
//               Audio: {websocketStatus.audio}
//             </span>
//           </div>
//         </div>
//         <div className="exam-status">
//           <div className={`status-indicator ${isStreaming ? "active" : "inactive"}`}>
//             {isStreaming ? "Proctoring Active" : "Proctoring Inactive"}
//           </div>
//         </div>
//       </main>
//       <footer className="app-footer">
//         <p>&copy; 2025 Your Company Name. All rights reserved.</p>
//       </footer>
//     </div>
//   );
// }

// export default App;


// import { useRef, useEffect, useState, useCallback } from "react";
// import './App.css';

// function App() {
//   const videoRef = useRef(null);
//   const websocketRef = useRef(null);
//   const streamingIntervalRef = useRef(null);
//   const canvasRef = useRef(null);

//   const [isStreaming, setIsStreaming] = useState(false);
//   const [frameRate, setFrameRate] = useState(10); // Adjustable frame rate
//   const [detectionData, setDetectionData] = useState({
//     cell_phone_boxes: [],
//     head_direction: "Unknown",
//     people_count: 0,
//   });

//   useEffect(() => {
//     const startCamera = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { width: 1280, height: 720 },
//           audio: false,
//         });
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream;
//         }
//       } catch (error) {
//         console.error("Error accessing the camera:", error);
//       }
//     };

//     startCamera();

//     websocketRef.current = new WebSocket("ws://127.0.0.1:8000/video");

//     websocketRef.current.onopen = () => console.log("WebSocket connected");
//     websocketRef.current.onclose = (event) => console.warn("WebSocket closed", event);
//     websocketRef.current.onerror = (error) => console.error("WebSocket error", error);

//     websocketRef.current.onmessage = (event) => {
//       const data = JSON.parse(event.data);
//       setDetectionData(data);
//     };

//     return () => {
//       if (websocketRef.current) websocketRef.current.close();
//       if (videoRef.current && videoRef.current.srcObject) {
//         const tracks = videoRef.current.srcObject.getTracks();
//         tracks.forEach((track) => track.stop());
//       }
//     };
//   }, []);

//   const startStreaming = useCallback(() => {
//     if (
//       !videoRef.current ||
//       !websocketRef.current ||
//       websocketRef.current.readyState !== WebSocket.OPEN
//     )
//       return;

//     if (isStreaming) {
//       console.log("Streaming is already running");
//       return;
//     }

//     setIsStreaming(true);
//     streamingIntervalRef.current = setInterval(() => {
//       const canvas = document.createElement("canvas");
//       canvas.width = videoRef.current.videoWidth;
//       canvas.height = videoRef.current.videoHeight;

//       const context = canvas.getContext("2d");
//       context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

//       canvas.toBlob((blob) => {
//         if (blob && websocketRef.current.readyState === WebSocket.OPEN) {
//           websocketRef.current.send(blob);
//         }
//       }, "image/jpeg");
//     }, 1000 / frameRate);
//   }, [isStreaming, frameRate]);

//   const stopStreaming = useCallback(() => {
//     if (streamingIntervalRef.current) {
//       clearInterval(streamingIntervalRef.current);
//       streamingIntervalRef.current = null;
//     }
//     setIsStreaming(false);
//     console.log("Streaming stopped");
//   }, []);

//   useEffect(() => {
//     const drawDetections = () => {
//       const canvas = canvasRef.current;
//       const video = videoRef.current;

//       if (canvas && video && detectionData) {
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         const context = canvas.getContext("2d");
//         context.clearRect(0, 0, canvas.width, canvas.height);

//         // Draw video frame
//         context.drawImage(video, 0, 0, canvas.width, canvas.height);

//         // Draw bounding boxes for cell phones
//         detectionData.cell_phone_boxes.forEach((box) => {
//           context.strokeStyle = "#FF00FF"; // Pink color
//           context.lineWidth = 3;
//           context.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
//           context.font = "18px Arial";
//           context.fillStyle = "#00FF00"; // Green color
//           context.fillText("Cell Phone", box.x1, box.y1 - 10);
//         });

//         // Draw head direction
//         context.font = "24px Arial";
//         context.fillStyle = "#FFFFFF"; // White color
//         context.fillText(
//           `Head Directcion: ${detectionData.head_direction}`,
//           20,
//           canvas.height - 50
//         );

//         // Draw people count
//         context.fillText(
//           `People Count: ${detectionData.people_count}`,
//           20,
//           canvas.height - 20
//         );
//       }
//     };

//     const interval = setInterval(drawDetections, 1000 / frameRate);
//     return () => clearInterval(interval);
//   }, [detectionData, frameRate]);

//   return (
//     <div className="app-container">
//       <header className="app-header">
//         <h1>Online Exam Proctoring System</h1>
//       </header>
//       <main className="app-main">
//         <div className="video-container">
//           <video
//             ref={videoRef}
//             autoPlay
//             playsInline
//             className="hidden-video"
//           ></video>
//           <canvas ref={canvasRef} className="video-canvas"></canvas>
//         </div>
//         <div className="controls">
//           <button
//             onClick={startStreaming}
//             disabled={isStreaming}
//             className="control-button start-button"
//           >
//             Start Proctoring
//           </button>
//           <button
//             onClick={stopStreaming}
//             disabled={!isStreaming}
//             className="control-button stop-button"
//           >
//             Stop Proctoring
//           </button>
//           <div className="frame-rate-control">
//             <label htmlFor="frameRate">Frame Rate:</label>
//             <input
//               id="frameRate"
//               type="number"
//               value={frameRate}
//               onChange={(e) => setFrameRate(Number(e.target.value))}
//               min="1"
//               max="60"
//               className="frame-rate-input"
//             />
//           </div>
//         </div>
//         <div className="detection-info">
//           <h2>Proctoring Details</h2>
//           <div className="info-item">
//             <strong>Head Direction:</strong> {detectionData.head_direction}
//           </div>
//           <div className="info-item">
//             <strong>Number of People Detected:</strong> {detectionData.people_count}
//           </div>
//           <div className="info-item">
//             <strong>Detected Devices:</strong> {detectionData.cell_phone_boxes.length}
//           </div>
//         </div>
//         <div className="exam-status">
//           <div className={`status-indicator ${isStreaming ? 'active' : 'inactive'}`}>
//             {isStreaming ? "Proctoring Active" : "Proctoring Inactive"}
//           </div>
//           {/* Optional: Add a timer or other exam-related info here */}
//         </div>
//       </main>
//       <footer className="app-footer">
//         <p>&copy; 2025 Your Company Name. All rights reserved.</p>
//       </footer>
//     </div>
//   );
// }

// export default App;

import { useRef, useEffect, useState, useCallback } from "react";
import './App.css';

function App() {
  const videoRef = useRef(null);
  const websocketRef = useRef(null); // For video
  const audioWebSocketRef = useRef(null); // For audio
  const streamingIntervalRef = useRef(null);
  const canvasRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [frameRate, setFrameRate] = useState(10); // Adjustable frame rate
  const [detectionData, setDetectionData] = useState({
    cell_phone_boxes: [],
    head_direction: "Unknown",
    people_count: 0,
  });

  // Audio streaming state and refs
  const [isRecording, setIsRecording] = useState(false);
  const [speechDetected, setSpeechDetected] = useState(false);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing the camera:", error);
      }
    };

    startCamera();

    // Video WebSocket connection
    websocketRef.current = new WebSocket("ws://127.0.0.1:8000/video");

    websocketRef.current.onopen = () => console.log("Video WebSocket connected");
    websocketRef.current.onclose = (event) => console.warn("Video WebSocket closed", event);
    websocketRef.current.onerror = (error) => console.error("Video WebSocket error", error);

    websocketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setDetectionData(data);
    };

    // Audio WebSocket connection
    audioWebSocketRef.current = new WebSocket("ws://127.0.0.1:8001/audio");

    audioWebSocketRef.current.onopen = () => console.log("Audio WebSocket connected");
    audioWebSocketRef.current.onclose = (event) => console.warn("Audio WebSocket closed", event);
    audioWebSocketRef.current.onerror = (error) => console.error("Audio WebSocket error", error);

    audioWebSocketRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      setSpeechDetected(response.speech_timestamps.length > 0);
      console.log("Speech detected:", response.speech_timestamps.length > 0);
      console.log("VAD Response:", response);
    };

    return () => {
      if (websocketRef.current) websocketRef.current.close();
      if (audioWebSocketRef.current) audioWebSocketRef.current.close();
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

  useEffect(() => {
    const drawDetections = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video && detectionData) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw bounding boxes for cell phones
        detectionData.cell_phone_boxes.forEach((box) => {
          context.strokeStyle = "#FF00FF"; // Pink color
          context.lineWidth = 3;
          context.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
          context.font = "18px Arial";
          context.fillStyle = "#00FF00"; // Green color
          context.fillText("Cell Phone", box.x1, box.y1 - 10);
        });

        // Draw head direction
        context.font = "24px Arial";
        context.fillStyle = "#FFFFFF"; // White color
        context.fillText(
          `Head Direction: ${detectionData.head_direction}`,
          20,
          canvas.height - 50
        );

        // Draw people count
        context.fillText(
          `People Count: ${detectionData.people_count}`,
          20,
          canvas.height - 20
        );
      }
    };

    const interval = setInterval(drawDetections, 1000 / frameRate);
    return () => clearInterval(interval);
  }, [detectionData, frameRate]);

  // Audio streaming functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
        } 
      });

      streamRef.current = stream;
      
      // Create AudioContext for format conversion
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      processorRef.current.onaudioprocess = (e) => {
        if (audioWebSocketRef.current && audioWebSocketRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array
          const intData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            intData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Send audio data to the audio WebSocket server
          audioWebSocketRef.current.send(intData.buffer);
          console.log("Sending audio chunk, size:", intData.length);
        }
      };

      setIsRecording(true);
      console.log("Recording started");
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    console.log("Stopping recording...");
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    console.log("Recording stopped");
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Online Exam Proctoring System</h1>
      </header>
      <main className="app-main">
        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="hidden-video"
          ></video>
          <canvas ref={canvasRef} className="video-canvas"></canvas>
        </div>
        <div className="controls">
          <button
            onClick={startStreaming}
            disabled={isStreaming}
            className="control-button start-button"
          >
            Start Proctoring
          </button>
          <button
            onClick={stopStreaming}
            disabled={!isStreaming}
            className="control-button stop-button"
          >
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
          <button 
            onClick={startRecording} 
            disabled={isRecording}
            style={{ 
              padding: '10px 20px',
              margin: '5px',
              backgroundColor: isRecording ? '#ccc' : '#4CAF50'
            }}
          >
            Start Recording
          </button>
          <button 
            onClick={stopRecording} 
            disabled={!isRecording}
            style={{ 
              padding: '10px 20px',
              margin: '5px',
              backgroundColor: !isRecording ? '#ccc' : '#f44336'
            }}
          >
            Stop Recording
          </button>
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
          <div className="info-item">
            <strong>Speech Detected:</strong> {speechDetected ? '🗣️ Yes' : '❌ No'}
          </div>
        </div>
        <div className="exam-status">
          <div className={`status-indicator ${isStreaming ? 'active' : 'inactive'}`}>
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
