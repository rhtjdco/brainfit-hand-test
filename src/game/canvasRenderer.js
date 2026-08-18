import { BALL_TYPES } from "../constants/ballTypes";
import { getDistance } from "../utils";

// 공 그리기
export const drawBall = (ctx, ball, width, height) => {
  if (ball.x < 0 || ball.y < 0) return;

  const x = ball.x * width;
  const y = ball.y * height;
  const radius = ball.radius;
  const type = BALL_TYPES[ball.type];

  if (!type) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 16;

  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.08,
    x,
    y,
    radius
  );

  gradient.addColorStop(0, "#FFFFFF");
  gradient.addColorStop(0.18, type.color);
  gradient.addColorStop(0.75, type.color);
  gradient.addColorStop(1, "#4D5660");

  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  // 빛 반사 효과
  ctx.beginPath();
  ctx.arc(
    x - radius * 0.28,
    y - radius * 0.3,
    radius * 0.055,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();

  // 잡고 있는 공 강조 표시
  if (ball.grabbed) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

// 목표 영역 그리기
export const drawTarget = (ctx, target, width, height, label) => {
  if (!target) return;

  const x = target.x * width;
  const y = target.y * height;
  // target 객체의 radius 속성을 활용하도록 수정 (기본값 0.11 비율 대응)
  const radius = target.radius ? target.radius * height : 65;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  ctx.globalAlpha = 0.33;
  ctx.fillStyle = target.color;
  ctx.fill();

  ctx.globalAlpha = 1;
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

// 손 그리기
export const drawHands = (ctx, width, height, hands, balls) => {
  hands.forEach((hand) => {
    const x = hand.x * width;
    const y = hand.y * height;

    // 손 영역
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = hand.fist
      ? "rgba(233,155,155,0.18)"
      : "rgba(255,255,255,0.08)";
    ctx.fill();

    // 중앙 점
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = hand.fist ? "#E99B9B" : "#FFFFFF";
    ctx.fill();

    // 테두리
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = hand.fist ? "#E99B9B" : "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 가장 가까운 공 찾기
    let nearestBall = null;
    let nearestDistance = Infinity;

    balls.forEach((ball) => {
      if (ball.x < 0) return;

      const distance = getDistance(hand, ball);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBall = ball;
      }
    });

    // 손과 공 연결 점선
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

// 전체 Canvas 렌더링
export const renderGame = ({
  canvas,
  mission,
  balls,
  hands,
  movingTarget,
  staticTargets,
}) => {
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  // Canvas 해상도 조율
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // 1. 목표 영역 그리기
  if (mission.type === "MOVING_TARGET") {
    drawTarget(ctx, movingTarget, width, height, movingTarget?.label);
  } else if (mission.type !== "SEQUENCE") {
    staticTargets.forEach((target) => {
      drawTarget(ctx, target, width, height, target.label);
    });
  }

  // 2. 공 그리기
  balls.forEach((ball) => {
    drawBall(ctx, ball, width, height);
  });

  // 3. 손 그리기
  drawHands(ctx, width, height, hands, balls);
};