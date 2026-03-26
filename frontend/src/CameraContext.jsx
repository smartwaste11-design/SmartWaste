import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

const CameraContext = createContext(null);

export function CameraProvider({ children }) {
  const hiddenVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startStream = useCallback(async () => {
    if (streamRef.current) return streamRef.current; // already running
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = stream;
        await hiddenVideoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      return stream;
    } catch (e) {
      console.error('CameraContext: failed to start stream', e);
      return null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  // Capture a single frame from the live stream and return base64 jpeg
  const captureFrame = useCallback((location = '') => {
    const video = hiddenVideoRef.current;
    if (!video || !streamRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Stamp timestamp + location
    const now = new Date().toLocaleString();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Completed: ${now}${location ? '  |  ' + location : ''}`, 10, canvas.height - 12);

    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  // Returns the current MediaStream (or null)
  const getStream = useCallback(() => streamRef.current, []);

  return (
    <CameraContext.Provider value={{ cameraActive, startStream, stopStream, captureFrame, getStream }}>
      {/* Hidden persistent video — keeps stream alive across page switches */}
      <video
        ref={hiddenVideoRef}
        playsInline
        muted
        autoPlay
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
      />
      {children}
    </CameraContext.Provider>
  );
}

export function useCameraContext() {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error('useCameraContext must be used inside CameraProvider');
  return ctx;
}
