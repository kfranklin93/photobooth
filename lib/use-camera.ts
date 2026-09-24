"use client";

import { useEffect, useRef, useState } from "react";

import { videoConstraints } from "@/lib/camera";

export type CameraState = "starting" | "live" | "unavailable";

/**
 * Opens the tablet camera and exposes a ref to attach to a <video>.
 *
 * getUserMedia needs a secure context: HTTPS, or localhost / 127.0.0.1. Loading
 * the dev server over the LAN by IP (http://192.168.x.x) silently disables the
 * camera, so use `npm run dev:https` when testing on the tablet.
 *
 * Tracks are always stopped on unmount, otherwise the tablet leaves its camera
 * light on between guests.
 */
/**
 * Returns the live MediaStream rather than a video ref, because several
 * previews render the same feed at once (the frame picker shows one tile per
 * frame). A single React ref can only point at one element, so each preview
 * attaches the shared stream to its own <video>.
 */
export function useCamera() {
  const [state, setState] = useState<CameraState>("starting");
  const [reason, setReason] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fail = (message: string) => {
      if (cancelled) return;
      setReason(message);
      setState("unavailable");
    };

    const start = async () => {
      if (typeof window === "undefined") return;

      if (!window.isSecureContext) {
        fail(
          "The camera needs a secure connection (HTTPS or 127.0.0.1). " +
            "Run `npm run dev:https` to test on a tablet over the network.",
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        fail("This browser does not support in-page camera capture.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints(),
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setStream(stream);
        setState("live");
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          fail(
            "Camera access was blocked. Allow the camera for this site in your " +
              "browser settings, then reload.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          fail("No camera was found on this device.");
        } else if (name === "NotReadableError") {
          fail("The camera is already in use by another app. Close it and reload.");
        } else {
          fail("The camera could not be started.");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { state, reason, stream };
}
