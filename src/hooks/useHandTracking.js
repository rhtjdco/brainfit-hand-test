import { useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { CONFIG } from "../constants/gameConfig";
import { getDistance, lerp } from "../utils";

export const useHandTracking = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const handsRef = useRef([]);

  const distanceRef = useRef({ value: 50, status: "적정" });
  const lastDistanceUpdateRef = useRef(0);
  const handLostCountRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [screenDistance, setScreenDistance] = useState({ value: 50, status: "적정" });

  const getPalmCenter = (landmarks) => {
    const points = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    let x = 0, y = 0;
    points.forEach(point => { x += point.x; y += point.y; });
    return { x: x / points.length, y: y / points.length };
  };

  const getFistScore = (landmarks) => {
    const wrist = landmarks[0];
    const fingers = [
      { mcp: 5, pip: 6, dip: 7, tip: 8 },
      { mcp: 9, pip: 10, dip: 11, tip: 12 },
      { mcp: 13, pip: 14, dip: 15, tip: 16 },
      { mcp: 17, pip: 18, dip: 19, tip: 20 },
    ];
    let score = 0;

    fingers.forEach(({ mcp, pip, dip, tip }) => {
      const mcpDistance = getDistance(landmarks[mcp], wrist);
      const pipDistance = getDistance(landmarks[pip], wrist);
      const dipDistance = getDistance(landmarks[dip], wrist);
      const tipDistance = getDistance(landmarks[tip], wrist);

      if (tipDistance < mcpDistance * 1.35) score += 0.75;
      if (tipDistance < pipDistance * 1.25) score += 0.5;
      if (tipDistance < dipDistance * 1.18) score += 0.35;
    });
    return score;
  };

  const updateFistState = (previous, score) => {
    if (previous) return score > CONFIG.fistExitThreshold;
    return score > CONFIG.fistEnterThreshold;
  };

  const getStableHandPosition = (landmarks, previousHand) => {
    const palm = getPalmCenter(landmarks);
    const wrist = landmarks[0];
    const middleBase = landmarks[9];

    const stableX = palm.x * 0.65 + middleBase.x * 0.25 + wrist.x * 0.10;
    const stableY = palm.y * 0.65 + middleBase.y * 0.25 + wrist.y * 0.10;
    const targetX = 1 - stableX;
    const targetY = stableY;

    if (!previousHand) return { x: targetX, y: targetY };
    return {
      x: lerp(previousHand.x, targetX, CONFIG.positionSmooth),
      y: lerp(previousHand.y, targetY, CONFIG.positionSmooth),
    };
  };

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;

      await new Promise(resolve => { videoRef.current.onloadedmetadata = resolve; });
      await videoRef.current.play();
      setCameraReady(true);
    } catch (error) {
      console.error("카메라 시작 실패", error);
    }
  };

  const initializeMediaPipe = async () => {
    if (handLandmarkerRef.current) return;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          // 로컬 tflite 모델 파일 경로 지정
          modelAssetPath: "/hand_detector.tflite",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
    } catch (error) {
      console.error("MediaPipe 초기화 실패", error);
    }
  };

  const detectHands = (timestamp) => {
    if (!videoRef.current || !handLandmarkerRef.current || videoRef.current.readyState < 2) return;

    try {
      const result = handLandmarkerRef.current.detectForVideo(videoRef.current, timestamp);

      if (result.landmarks && result.landmarks.length > 0) {
        handLostCountRef.current = 0;
        const landmarks = result.landmarks[0];
        const wrist = landmarks[0];
        const middleBase = landmarks[9];

        const handSize = Math.sqrt(Math.pow(wrist.x - middleBase.x, 2) + Math.pow(wrist.y - middleBase.y, 2));

        let status;
        if (handSize < 0.15) status = "너무 멂";
        else if (handSize < 0.32) status = "적정";
        else status = "너무 가까움";

        let value;
        if (handSize < 0.15) value = (handSize / 0.15) * 35;
        else if (handSize < 0.32) value = 35 + ((handSize - 0.15) / 0.10) * 30;
        else value = 65 + Math.min(35, ((handSize - 0.32) / 0.10) * 35);
        value = Math.max(0, Math.min(100, value));

        const smooth = distanceRef.current.value * 0.75 + value * 0.25;
        distanceRef.current = { value: smooth, status };

        if (timestamp - lastDistanceUpdateRef.current > CONFIG.distanceUpdateInterval) {
          lastDistanceUpdateRef.current = timestamp;
          setScreenDistance({ value: smooth, status });
        }
      } else {
        handLostCountRef.current += 1;
        if (handLostCountRef.current >= CONFIG.handLostMaxFrames) {
          setScreenDistance({ value: 5, status: "인식되지 않음" });
        }
      }

      const previousHands = handsRef.current;
      const detectedHands = [];
      const claimedPreviousIds = new Set();

      if (result.landmarks) {
        result.landmarks.forEach((landmarks) => {
          const palm = getPalmCenter(landmarks);
          const rawX = 1 - palm.x;
          const rawY = palm.y;

          let previousHand = null;
          let closest = Infinity;

          previousHands.forEach(hand => {
            if (claimedPreviousIds.has(hand.id)) return;
            const distance = getDistance(hand, { x: rawX, y: rawY });
            if (distance < closest) {
              closest = distance;
              previousHand = hand;
            }
          });

          if (closest > 0.4) previousHand = null;
          if (previousHand) claimedPreviousIds.add(previousHand.id);

          const position = getStableHandPosition(landmarks, previousHand);
          const fistScore = getFistScore(landmarks);
          const fist = updateFistState(previousHand?.fist ?? false, fistScore);
          const fistJustClosed = fist && !(previousHand?.fist ?? false);

          detectedHands.push({
            id: previousHand?.id ?? `hand-${Math.random()}`,
            x: position.x,
            y: position.y,
            fist,
            fistJustClosed,
            fistScore,
            landmarks,
            lastSeen: timestamp,
          });
        });
      }

      previousHands.forEach(previous => {
        const exists = detectedHands.some(hand => hand.id === previous.id);
        if (!exists && timestamp - previous.lastSeen < CONFIG.lostHandGraceTime) {
          detectedHands.push({ ...previous });
        }
      });

      handsRef.current = detectedHands;
      setHandCount(result.landmarks?.length || 0);
    } catch (error) {
      console.error("손 인식 및 거리 측정 오류", error);
    }
  };

  const cleanup = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }

    if (handLandmarkerRef.current) {
      try {
        handLandmarkerRef.current.close();
      } catch (e) {
        console.error("MediaPipe close error:", e);
      }
      handLandmarkerRef.current = null;
    }

    setCameraReady(false);
  };

  return {
    videoRef,
    handsRef,
    cameraReady,
    handCount,
    screenDistance,
    initializeMediaPipe,
    startCamera,
    detectHands,
    cleanup,
  };
}