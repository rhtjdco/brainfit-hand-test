import { useEffect, useRef } from "react";

export const useGameLoop = ({ enabled, onFrame, }) => {
  const animationRef = useRef(null);
  const callbackRef = useRef(onFrame);

  useEffect(() => {
    callbackRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!enabled) return;

    const loop = (timestamp) => {
      callbackRef.current(timestamp);
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = null;
    };
  }, [enabled]);
};