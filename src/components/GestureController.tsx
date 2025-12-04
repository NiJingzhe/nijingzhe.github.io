import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { CanvasState } from '../types';
import { Loader2, Camera, CameraOff } from 'lucide-react';

interface GestureControllerProps {
  onUpdateCanvas: (changes: Partial<CanvasState>) => void;
  currentCanvas: CanvasState;
}

export const GestureController: React.FC<GestureControllerProps> = ({ onUpdateCanvas, currentCanvas }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gestureStatus, setGestureStatus] = useState<string>('Initializing...');
  
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();
  
  // Gesture State Refs
  const lastPinchRef = useRef<{ x: number; y: number } | null>(null);
  const lastFistDistanceRef = useRef<number | null>(null);
  const currentCanvasRef = useRef<CanvasState>(currentCanvas);

  // Keep currentCanvasRef in sync
  useEffect(() => {
    currentCanvasRef.current = currentCanvas;
  }, [currentCanvas]);
  
  // Constants
  const PINCH_THRESHOLD = 0.05;
  const PAN_SENSITIVITY = 2.5; // Multiplier for pan movement
  const ZOOM_SENSITIVITY = 0.002; // Multiplier for zoom speed
  const SMOOTHING_FACTOR = 0.5; // Low-pass filter factor (0-1)

  useEffect(() => {
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        startWebcam();
      } catch (err) {
        console.error(err);
        setError('Failed to load hand tracking model');
        setLoading(false);
      }
    };

    init();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      // Cleanup video stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      }
      setLoading(false);
      setGestureStatus('Ready');
    } catch (err) {
      console.error(err);
      setError('Camera access denied');
      setLoading(false);
    }
  };

  const isFist = (landmarks: any[]) => {
    // Check if fingertips are lower than PIP joints (simple check for upright hand)
    // Or check distance from tip to wrist vs PIP to wrist
    // Index: 8 (tip), 6 (PIP). Middle: 12, 10. Ring: 16, 14. Pinky: 20, 18.
    // Thumb (4) is tricky, usually ignored for simple fist or checked separately.
    
    const fingerTips = [8, 12, 16, 20];
    const fingerPips = [6, 10, 14, 18];
    
    // In screen coordinates (y increases downwards), curled finger tip y > pip y
    // But hand can be rotated. Better metric: Tip to Wrist distance < PIP to Wrist distance
    const wrist = landmarks[0];
    
    const isCurled = (tipIdx: number, pipIdx: number) => {
      const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
      const dPip = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
      return dTip < dPip;
    };

    return fingerTips.every((tip, i) => isCurled(tip, fingerPips[i]));
  };

  const isPinch = (landmarks: any[]) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    return distance < PINCH_THRESHOLD;
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Prepare canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    let startTimeMs = performance.now();
    let results: HandLandmarkerResult | null = null;
    
    try {
      results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
    } catch (e) {
      console.warn("Detection error", e);
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw video frame (mirrored)
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Draw landmarks
    if (results && results.landmarks) {
      const drawingUtils = new DrawingUtils(ctx);
      for (const landmarks of results.landmarks) {
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 2
        });
        drawingUtils.drawLandmarks(landmarks, {
          color: "#FF0000",
          lineWidth: 1
        });
      }

      handleGestures(results);
    } else {
      setGestureStatus('No hands detected');
      lastPinchRef.current = null;
      lastFistDistanceRef.current = null;
    }
    
    ctx.restore();
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const handleGestures = (results: HandLandmarkerResult) => {
    const landmarks = results.landmarks;
    
    if (landmarks.length === 0) {
      setGestureStatus('No hands');
      return;
    }

    // 1. Two Hands -> Check for Zoom (Two Fists)
    if (landmarks.length === 2) {
      const hand1 = landmarks[0];
      const hand2 = landmarks[1];
      
      if (isFist(hand1) && isFist(hand2)) {
        setGestureStatus('Zooming (Two Fists)');
        
        // Calculate distance between wrists
        const dist = Math.hypot(hand1[0].x - hand2[0].x, hand1[0].y - hand2[0].y);
        
        if (lastFistDistanceRef.current !== null) {
          const delta = dist - lastFistDistanceRef.current;
          // If distance increases, zoom in (scale up). 
          // Delta is usually small (e.g. 0.01), scale is around 1.
          // We want a smooth zoom.
          
          // Note: MediaPipe x coordinates are mirrored if we drew them mirrored, 
          // but the raw landmarks are normalized 0-1. 
          // If hands move apart, dist increases.
          
          const zoomFactor = 1 + delta * 2; // Amplify effect
          
          // Apply zoom centered on screen
          const currentScale = currentCanvasRef.current.scale;
          const newScale = Math.max(0.1, Math.min(5, currentScale * zoomFactor));
          
          // Calculate center of viewport
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          
          // Adjust x and y to keep center fixed
          // x_new = cx - (cx - x) * (newScale / oldScale)
          const newX = centerX - (centerX - currentCanvasRef.current.x) * (newScale / currentScale);
          const newY = centerY - (centerY - currentCanvasRef.current.y) * (newScale / currentScale);
          
          onUpdateCanvas({
            scale: newScale,
            x: newX,
            y: newY
          });
        }
        
        lastFistDistanceRef.current = dist;
        lastPinchRef.current = null; // Reset pinch
        return;
      }
    }
    
    // 2. One Hand (or Two but not fists) -> Check for Pan (Pinch)
    // We'll prioritize the first hand that is pinching
    const pinchingHand = landmarks.find(lm => isPinch(lm));
    
    if (pinchingHand) {
      setGestureStatus('Panning (OK Gesture)');
      lastFistDistanceRef.current = null; // Reset zoom
      
      // Use midpoint of thumb and index as cursor
      const thumb = pinchingHand[4];
      const index = pinchingHand[8];
      let midX = (thumb.x + index.x) / 2;
      let midY = (thumb.y + index.y) / 2;
      
      // Apply smoothing if we have a previous point
      if (lastPinchRef.current) {
        midX = lastPinchRef.current.x * SMOOTHING_FACTOR + midX * (1 - SMOOTHING_FACTOR);
        midY = lastPinchRef.current.y * SMOOTHING_FACTOR + midY * (1 - SMOOTHING_FACTOR);
        
        const dx = (midX - lastPinchRef.current.x);
        const dy = (midY - lastPinchRef.current.y);
        
        const moveX = dx * window.innerWidth * PAN_SENSITIVITY;
        const moveY = dy * window.innerHeight * PAN_SENSITIVITY;
        
        onUpdateCanvas({
          x: currentCanvasRef.current.x - moveX, // Invert X for natural drag feel with mirrored camera
          y: currentCanvasRef.current.y + moveY
        });
      }
      
      lastPinchRef.current = { x: midX, y: midY };
    } else {
      setGestureStatus('Idle (Open Hand)');
      lastPinchRef.current = null;
      lastFistDistanceRef.current = null;
    }
  };

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 w-64 bg-red-900/80 text-white p-4 rounded-lg shadow-lg backdrop-blur border border-red-500 z-50">
        <div className="flex items-center gap-2 mb-2">
          <CameraOff size={20} />
          <span className="font-bold">Gesture Error</span>
        </div>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-48 bg-black/80 text-green-400 p-2 rounded-lg shadow-lg backdrop-blur border border-green-500/30 z-50 flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-green-500/30 pb-1">
        <div className="flex items-center gap-2">
          <Camera size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Gesture Cam</span>
        </div>
        {loading && <Loader2 size={14} className="animate-spin" />}
      </div>
      
      <div className="relative aspect-video w-full bg-black rounded overflow-hidden border border-green-900/50">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover opacity-0" // Hide video, show canvas
          autoPlay 
          playsInline 
          muted
        />
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      
      <div className="text-xs font-mono truncate">
        Status: <span className="text-white">{gestureStatus}</span>
      </div>
      
      <div className="text-[10px] text-gray-400 leading-tight">
        <div>✊+✊ : Zoom</div>
        <div>👌 : Drag</div>
        <div>:cg to close</div>
      </div>
    </div>
  );
};
