import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsReady(false);

      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setIsReady(true);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Camera access denied. Please enable camera permissions.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Failed to access camera. Please try again.");
        }
      }
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Get base64 image data (JPEG for smaller size)
    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    onCapture(imageData);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }, [stream, onCapture]);

  const toggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 bg-foreground z-50 flex flex-col items-center justify-center p-6">
        <div className="text-center text-background">
          <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Camera Unavailable</p>
          <p className="text-sm opacity-70 mb-6">{error}</p>
          <Button onClick={onClose} variant="outline" className="border-background text-background">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-foreground z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-4 flex items-center justify-between">
        <button onClick={onClose} className="p-2 rounded-full bg-foreground/50 text-background">
          <X className="w-6 h-6" />
        </button>
        <button onClick={toggleCamera} className="p-2 rounded-full bg-foreground/50 text-background">
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />

        {/* Loading overlay */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground">
            <div className="text-background text-center">
              <div className="w-8 h-8 border-2 border-background border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Receipt guide overlay */}
        <div className="absolute inset-8 pointer-events-none">
          <div className="relative w-full h-full border-2 border-primary/50 rounded-xl">
            {/* Corner indicators */}
            <div className="absolute -top-0.5 -left-0.5 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-xl" />
            <div className="absolute -top-0.5 -right-0.5 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-xl" />
            <div className="absolute -bottom-0.5 -left-0.5 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-xl" />
            <div className="absolute -bottom-0.5 -right-0.5 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-xl" />
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-24 left-0 right-0 flex justify-center">
          <div className="bg-primary px-4 py-2 rounded-full">
            <span className="text-sm font-medium text-primary-foreground">Align receipt within frame</span>
          </div>
        </div>
      </div>

      {/* Capture Button */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <button
          onClick={handleCapture}
          disabled={!isReady}
          className="w-20 h-20 rounded-full bg-background flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          <div className="w-16 h-16 rounded-full border-4 border-foreground" />
        </button>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
