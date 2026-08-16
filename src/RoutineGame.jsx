import React, { useEffect, useRef, useState } from "react";
import { BALL_TYPES } from "./constants/ballTypes";
import { CONFIG } from "./constants/gameConfig";
import {
  formatTime, getDistance, lerp, getRandomMission,
  createNormalBalls, createSameColorBalls,
  createMovingTargetBalls, createTimeAttackBalls
} from "./utils";
import { useHandTracking } from "./hooks/useHandTracking";
import "./RoutineGame.css";

function RoutineGame() {
  const {
    videoRef,
    handsRef,
    cameraReady,
    handCount,
    screenDistance,
    initializeMediaPipe,
    startCamera,
    detectHands,
    cleanup,
  } = useHandTracking();
  // ==================================================
  // DOM & Refs
  // ==================================================
  const canvasRef = useRef(null);

  // ==================================================
  // MediaPipe & 게임 & 미션
  // ==================================================
  const animationRef = useRef(null);
  const ballsRef = useRef([]);
  const missionRef = useRef(null);
  const missionProgressRef = useRef(0);
  const sequenceIndexRef = useRef(0);
  const sequenceOrderRef = useRef(["purple", "blue", "gray"]);
  const missionStartTimeRef = useRef(null);

  const movingTargetRef = useRef({
    x: 0.5, y: 0.45, radius: 0.11, vx: 0.00042, vy: 0.00024,
  });
  const sameColorTargetTypeRef = useRef("purple");
  const staticTargetsRef = useRef([]);

  // ==================================================
  // State
  // ==================================================
  const [isRunning, setIsRunning] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [successCount, setSuccessCount] = useState(0);

  const [mission, setMission] = useState(() => getRandomMission());
  const [missionStatus, setMissionStatus] = useState("playing");
  const [missionProgress, setMissionProgress] = useState(0);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [missionRemaining, setMissionRemaining] = useState(CONFIG.timeAttackDuration);
  const [isMissionComplete, setIsMissionComplete] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);

  // ==================================================
  // 미션 초기화
  // ==================================================
  const setupMission = (nextMission) => {
    missionRef.current = nextMission;
    missionProgressRef.current = 0;
    sequenceIndexRef.current = 0;
    missionStartTimeRef.current = performance.now();

    setMissionProgress(0);
    setSequenceIndex(0);
    setMissionRemaining(nextMission.type === "TIME_ATTACK" ? CONFIG.timeAttackDuration : 60);
    setMissionStatus("playing");
    setIsRunning(true);
    setIsMissionComplete(false);
    setIsTerminated(false);

    if (nextMission.type === "SAME_COLOR") {
      const sameColor = createSameColorBalls();
      sameColorTargetTypeRef.current = sameColor.targetType;
      ballsRef.current = sameColor.balls;
      staticTargetsRef.current = [{
        id: "single", x: 0.2 + Math.random() * 0.6, y: 0.55 + Math.random() * 0.15,
        radius: 0.13, color: BALL_TYPES[sameColor.targetType]?.color || "#8EA9B8", label: "모으기"
      }];
    } else if (nextMission.type === "MOVING_TARGET") {
      ballsRef.current = createMovingTargetBalls();
      movingTargetRef.current = {
        x: 0.22 + Math.random() * 0.56,
        y: 0.28 + Math.random() * 0.28,
        radius: 0.11, color: "#BBBBBB", label: "목표",
        vx: (Math.random() > 0.5 ? 1 : -1) * 0.00042,
        vy: (Math.random() > 0.5 ? 1 : -1) * 0.00024,
      };
    } else if (nextMission.type === "TIME_ATTACK") {
      ballsRef.current = createTimeAttackBalls();
      staticTargetsRef.current = [{
        id: "single", x: 0.2 + Math.random() * 0.6, y: 0.55 + Math.random() * 0.15,
        radius: 0.12, color: "#8EA9B8", label: "목표",
      }];
    } else if (nextMission.type === "SEQUENCE") {
      ballsRef.current = createNormalBalls();
      sequenceOrderRef.current = ["purple", "blue", "gray"].sort(() => Math.random() - 0.5);
      staticTargetsRef.current = [];
    } else {
      ballsRef.current = createNormalBalls();
      const xs = [0.25, 0.50, 0.75].sort(() => Math.random() - 0.5);
      staticTargetsRef.current = [
        { id: "purple", x: xs[0], y: 0.55 + Math.random() * 0.15, radius: 0.11, color: "#7C73A7", label: "보라" },
        { id: "blue", x: xs[1], y: 0.55 + Math.random() * 0.15, radius: 0.11, color: "#8EA9B8", label: "파랑" },
        { id: "gray", x: xs[2], y: 0.55 + Math.random() * 0.15, radius: 0.11, color: "#9A9A9A", label: "회색" },
      ];
    }
  };

  useEffect(() => {
    setupMission(mission);
  }, [mission]);


  // ==================================================
  // 로직
  // ==================================================
  const getTargetZone = (ball) => {
    const missionType = mission.type;

    if (missionType === "MOVING_TARGET") return { ...movingTargetRef.current };

    if (missionType === "COLOR_SORT") {
      return staticTargetsRef.current.find(t => t.id === ball.type) || staticTargetsRef.current[0];
    }

    return staticTargetsRef.current[0];
  };

  const isInsideTarget = (ball, target) => getDistance(ball, target) < target.radius;

  const completeMission = () => {
    setSuccessCount(previous => previous + 1);
    setIsMissionComplete(true);
    setIsRunning(false);
  };

  const failMission = () => {
    setupMission(mission);
  };

  const handleBallRelease = (ball, target) => {
    if (mission.type === "COLOR_SORT") {
      if (isInsideTarget(ball, target)) {
        missionProgressRef.current += 1;
        setMissionProgress(missionProgressRef.current);
        ball.x = -1;
        ball.y = -1;
        if (missionProgressRef.current >= 3) completeMission();
      }
      return;
    }

    if (mission.type === "SEQUENCE") {
      const sequence = sequenceOrderRef.current;
      const expected = sequence[sequenceIndexRef.current];

      if (ball.type !== expected) {
        failMission();
        return;
      }

      sequenceIndexRef.current += 1;
      setSequenceIndex(sequenceIndexRef.current);

      ball.x = -1;
      ball.y = -1;

      if (sequenceIndexRef.current >= sequence.length) completeMission();
      return;
    }


    if (mission.type === "MOVING_TARGET") {
      if (isInsideTarget(ball, target)) {
        missionProgressRef.current += 1;
        setMissionProgress(missionProgressRef.current);
        ball.x = -1;
        ball.y = -1;
        if (missionProgressRef.current >= 3) completeMission();
      }
      return;
    }

    if (mission.type === "SAME_COLOR") {
      if (ball.type !== sameColorTargetTypeRef.current) return;
      if (isInsideTarget(ball, target)) {
        missionProgressRef.current += 1;
        setMissionProgress(missionProgressRef.current);
        ball.x = -1;
        ball.y = -1;
        if (missionProgressRef.current >= 3) completeMission();
      }
      return;
    }

    if (mission.type === "TIME_ATTACK") {
      if (isInsideTarget(ball, target)) {
        missionProgressRef.current += 1;
        setMissionProgress(missionProgressRef.current);
        ball.x = -1;
        ball.y = -1;
        if (missionProgressRef.current >= 3) completeMission();
      }
    }
  };

  const updateBalls = (now) => {
    const balls = ballsRef.current;
    const hands = handsRef.current;

    if (mission.type === "MOVING_TARGET") {
      const target = movingTargetRef.current;
      target.x += target.vx;
      target.y += target.vy;
      if (target.x > 0.65 || target.x < 0.22) {
        target.vx *= -1;
        target.x = Math.max(0.22, Math.min(0.65, target.x));
      }
      if (target.y > 0.58 || target.y < 0.25) {
        target.vy *= -1;
        target.y = Math.max(0.25, Math.min(0.58, target.y));
      }
    }

    if (mission.type === "TIME_ATTACK" && missionStartTimeRef.current) {
      const elapsed = Math.floor((now - missionStartTimeRef.current) / 1000);
      const remaining = Math.max(0, CONFIG.timeAttackDuration - elapsed);
      setMissionRemaining(remaining);
      if (remaining <= 0) {
        failMission();
        return;
      }
    }

    balls.forEach(ball => {
      if (!ball.grabbed) return;

      let hand = hands.find(candidate => candidate.id === ball.grabbedBy);

      if (!hand) {
        ball.grabbed = false;
        ball.grabbedBy = null;
        ball.releaseStartTime = null;
        return;
      }

      if (hand.fist) {
        ball.releaseStartTime = null;
        const targetX = hand.x + ball.grabOffsetX;
        const targetY = hand.y + ball.grabOffsetY;

        ball.x = lerp(ball.x, targetX, CONFIG.ballFollowSmooth);
        ball.y = lerp(ball.y, targetY, CONFIG.ballFollowSmooth);
        ball.x = Math.max(0.05, Math.min(0.95, ball.x));
        ball.y = Math.max(0.05, Math.min(0.95, ball.y));
        return;
      }

      if (ball.releaseStartTime === null) {
        ball.releaseStartTime = now;
        return;
      }

      if (now - ball.releaseStartTime >= CONFIG.ballReleaseDelay) {
        const target = getTargetZone(ball);
        ball.grabbed = false;
        ball.grabbedBy = null;
        ball.releaseStartTime = null;
        handleBallRelease(ball, target);
      }
    });

    const occupiedHandIds = new Set(
      balls.filter(ball => ball.grabbed && ball.grabbedBy).map(ball => ball.grabbedBy)
    );
    const availableHands = hands
      .filter(hand => hand.fistJustClosed)
      .filter(hand => !occupiedHandIds.has(hand.id));

    availableHands.forEach(hand => {
      let nearestBall = null;
      let nearestDistance = Infinity;

      balls.forEach(ball => {
        if (ball.grabbed || ball.x < 0) return;
        const distance = getDistance(hand, ball);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBall = ball;
        }
      });

      if (nearestBall && nearestDistance < CONFIG.ballGrabDistance) {
        if (mission.type === "SEQUENCE") {
          const sequence = sequenceOrderRef.current;
          const expected = sequence[sequenceIndexRef.current];
          if (nearestBall.type !== expected) {
            failMission();
            return;
          }
        }
        nearestBall.grabbed = true;
        nearestBall.grabbedBy = hand.id;
        nearestBall.grabOffsetX = nearestBall.x - hand.x;
        nearestBall.grabOffsetY = nearestBall.y - hand.y;
        occupiedHandIds.add(hand.id);
      }
    });
  };

  // ==================================================
  // 렌더링 도구
  // ==================================================
  const drawBall = (ctx, ball, width, height) => {
    if (ball.x < 0 || ball.y < 0) return;
    const x = ball.x * width;
    const y = ball.y * height;
    const radius = ball.radius;
    const type = BALL_TYPES[ball.type];

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 16;

    const gradient = ctx.createRadialGradient(
      x - radius * 0.35, y - radius * 0.35, radius * 0.08, x, y, radius
    );
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(0.18, type.color);
    gradient.addColorStop(0.75, type.color);
    gradient.addColorStop(1, "#4D5660");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x - radius * 0.28, y - radius * 0.30, radius * 0.055, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();

    if (ball.grabbed) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const drawTarget = (ctx, target, width, height, label) => {
    const x = target.x * width;
    const y = target.y * height;
    const radius = 65;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.globalAlpha = 0.33;
    ctx.fillStyle = target.color;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = target.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
    }
    ctx.restore();
  };

  const drawHands = (ctx, width, height) => {
    handsRef.current.forEach(hand => {
      const x = hand.x * width;
      const y = hand.y * height;

      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = hand.fist ? "rgba(233,155,155,0.18)" : "rgba(255,255,255,0.08)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = hand.fist ? "#E99B9B" : "#FFFFFF";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = hand.fist ? "#E99B9B" : "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      let nearestBall = null;
      let nearestDistance = Infinity;

      ballsRef.current.forEach(ball => {
        if (ball.x < 0) return;
        const distance = getDistance(hand, ball);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBall = ball;
        }
      });

      if (nearestBall && nearestDistance < 0.13) {
        const ballX = nearestBall.x * width;
        const ballY = nearestBall.y * height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ballX, ballY);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  };

  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (mission.type === "MOVING_TARGET") {
      drawTarget(ctx, movingTargetRef.current, width, height, movingTargetRef.current.label);
    } else if (mission.type !== "SEQUENCE") {
      staticTargetsRef.current.forEach(target => {
        drawTarget(ctx, target, width, height, target.label);
      });
    }

    ballsRef.current.forEach(ball => drawBall(ctx, ball, width, height));
    drawHands(ctx, width, height);
  };


  const gameLoop = (timestamp) => {
    if (isRunning) {
      detectHands(timestamp);
      updateBalls(timestamp);
    }
    renderGame();
    animationRef.current = requestAnimationFrame(gameLoop);
  };

  // ==================================================
  // 생명주기 및 부가 기능
  // ==================================================
  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      await initializeMediaPipe();
      if (mounted) await startCamera();
    };
    initialize();

    return () => {
      mounted = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!cameraReady) return;
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [cameraReady, isRunning, mission]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setElapsedTime(previous => previous + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning, missionStatus]);

  useEffect(() => {
    if (isTerminated) {
      cleanup();
    }
  }, [isTerminated]);

  const resetGame = () => {
    setElapsedTime(0);
    setupMission(mission);
  };

  const getMissionSubText = () => {
    if (mission.type === "COLOR_SORT") return "공 3개를 각각 같은 색 영역에 넣어보세요";
    if (mission.type === "SEQUENCE") {
      const names = sequenceOrderRef.current.map(color => BALL_TYPES[color].name);
      return `순서: ${names.join(" → ")}`;
    }
    if (mission.type === "MOVING_TARGET") return "공 3개를 움직이는 목표에 모두 넣어보세요";
    if (mission.type === "SAME_COLOR") return `${BALL_TYPES[sameColorTargetTypeRef.current].name} 공 3개를 모두 모아보세요`;
    if (mission.type === "TIME_ATTACK") return `${missionRemaining}초 안에 공 3개를 목표 영역으로 옮겨보세요`;
    return "";
  };

  const handleStopGame = () => {
    setIsRunning(false);
    setIsTerminated(true);
  };

  const progressPercent = (mission.type === "SEQUENCE" ? sequenceIndex : missionProgress) / 3 * 100;

  // ==================================================
  // JSX
  // ==================================================
  return (
    <div className="routine-game">
      <div className="game-container">
        <div className="camera-preview">
          <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
          {!cameraReady && !isTerminated && <div className="camera-loading">카메라 준비 중...</div>}
        </div>

        <div className="live-time">
          <span className="live-dot" />
          지속 시간 {formatTime(elapsedTime)}
        </div>

        <div className="data-area">
          <div className="data-card">
            <div className="data-title">실시간 데이터</div>
            <div className="data-row">
              <div>
                <span>성공한 미션</span>
                <strong>{successCount}</strong>
              </div>
              <div>
                <span>손 인식</span>
                <strong>{handCount}</strong>
              </div>
            </div>
          </div>

          <div className="distance-card">
            <div className="distance-header">
              <span>화면 거리</span>
              <strong className={screenDistance.status === "적정" ? "distance-good" : "distance-warning"}>
                {screenDistance.status}
              </strong>
            </div>
            {screenDistance.status !== "인식되지 않음" && (
              <div className="distance-bar">
                <div className="distance-marker" style={{ left: `${screenDistance.value}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="play-area">
          <canvas ref={canvasRef} />
        </div>

        {isMissionComplete && !isTerminated && (
          <div className="overlay-container mission-complete-overlay">
            <h2>미션 완료</h2>
            <button className="mission-complete-button" onClick={resetGame}>
              방금 한 미션 다시 하기
            </button>
          </div>
        )}

        {isTerminated && (
          <div className="overlay-container terminated-overlay">
            <h2>종료되었습니다</h2>
            <p>수고하셨습니다!</p>
          </div>
        )}

        <div className="instruction">
          <span className="mission-text">{mission.title}</span>
          <span className="instruction-sub"> · {getMissionSubText()}</span>
        </div>

        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="steps">
            <span>STEP 1</span>
            <span>STEP 2</span>
            <span>STEP 3</span>
            <span>STEP 4</span>
          </div>
        </div>
      </div>

      <div className="control-area">
        <button className="stop-button" onClick={handleStopGame}>종료</button>
        <button className="reset-button" onClick={resetGame} disabled={isTerminated}>초기화</button>
      </div>
    </div>
  );
}

export default RoutineGame;