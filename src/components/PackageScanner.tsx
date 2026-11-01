"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type Dimensions = { lengthCm: number; widthCm: number; heightCm: number };

export function PackageScanner({ onMeasured }: { onMeasured: (dimensions: Dimensions) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [captured, setCaptured] = useState<Blob[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [arAvailable, setArAvailable] = useState(false);
  const [lidarAvailable] = useState(() => typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent));

  useEffect(() => {
    const nav = navigator as Navigator & { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } };
    nav.xr?.isSessionSupported?.("immersive-ar").then(setArAvailable).catch(() => setArAvailable(false));
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startCamera() {
    setStatus(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setStatus("Camera access was unavailable. Check browser permissions or enter dimensions manually.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setOpen(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && setCaptured((previous) => [...previous, blob]), "image/jpeg", 0.88);
  }

  async function measurePackage() {
    if (captured.length === 0) return;
    setBusy(true);
    setStatus("Sending package images for measurement…");
    const form = new FormData();
    captured.forEach((image, index) => form.append("images", image, `package-${index + 1}.jpg`));
    try {
      const response = await fetch("/api/measure-package", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.dimensions) throw new Error(result.message || "The measurement service could not measure this package.");
      onMeasured(result.dimensions);
      setStatus(`Measured ${result.dimensions.lengthCm} × ${result.dimensions.widthCm} × ${result.dimensions.heightCm} cm. Please confirm the values.`);
      closeCamera();
    } catch (error) {
      setStatus(error instanceof Error ? `${error.message} You can enter the dimensions manually.` : "Measurement failed. Enter the dimensions manually.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="rounded-control border border-border bg-surface-2 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-medium text-ink">Measure with camera</p><p className="text-xs text-ink-3">Guided photos estimate package dimensions.</p></div>
          <Button type="button" size="sm" variant="secondary" onClick={startCamera}>Open camera</Button>
        </div>
        {status && <p className="mt-2 text-xs text-danger">{status}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-control border border-border bg-surface-2 p-3 text-sm space-y-3">
      <video ref={videoRef} muted playsInline className="w-full max-h-64 rounded-lg bg-black object-contain" />
      <p className="text-xs text-ink-2">Take at least three photos: front, side, and top. Keep the whole parcel visible and place it beside a known-size reference card when possible.</p>
      <p className="text-xs text-ink-3">{arAvailable ? "AR measurement is available on this browser." : lidarAvailable ? "LiDAR-capable device detected; measurement service will use depth when supported." : "Standard camera mode is active."}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={captureFrame}>Capture photo ({captured.length})</Button>
        <Button type="button" size="sm" variant="secondary" onClick={measurePackage} disabled={!captured.length || busy} loading={busy}>Measure package</Button>
        <Button type="button" size="sm" variant="ghost" onClick={closeCamera}>Close</Button>
      </div>
      {status && <p className="text-xs text-ink-2">{status}</p>}
    </div>
  );
}
