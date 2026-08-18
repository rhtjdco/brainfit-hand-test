import { MISSIONS } from "./constants/missions";

// ======================================================
// 시간
// ======================================================
export const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
};

// ======================================================
// 거리
// ======================================================
export const getDistance = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
};

export const lerp = (current, target, amount) => {
  return current + (target - current) * amount;
};

// ======================================================
// 랜덤 미션
// ======================================================
export const getRandomMission = (excludeType = null) => {
  const candidates = MISSIONS.filter(
    item => item.type !== excludeType
  );

  const pool = candidates.length ? candidates : MISSIONS;
  const index = Math.floor(Math.random() * pool.length);

  return pool[index];
};

// ======================================================
// 공 생성
// ======================================================
export const createBall = (id, type, x, y) => {
  return {
    id,
    type,
    x,
    y,
    radius: 42,
    grabbed: false,
    grabbedBy: null,
    grabOffsetX: 0,
    grabOffsetY: 0,
    releaseStartTime: null,
  };
};

// ======================================================
// 안전한 공 위치
// ======================================================
export const getSafeBallPosition = (existing = []) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = {
      x: 0.20 + Math.random() * 0.60,
      y: 0.35 + Math.random() * 0.20,
    };

    if (existing.every(ball => getDistance(candidate, ball) > 0.18)) {
      return candidate;
    }
  }

  return { x: 0.50, y: 0.42 };
};

export const createNormalBalls = () => {
  const balls = [];
  ["green", "blue", "pink"].forEach((type, index) => {
    const position = getSafeBallPosition(balls);
    balls.push(createBall(`${type}-${index + 1}`, type, position.x, position.y));
  });
  return balls;
};

// ======================================================
// 같은 색 3개
// ======================================================
export const createSameColorBalls = () => {
  const types = ["green", "blue", "pink"];
  const targetType = types[Math.floor(Math.random() * types.length)];
  const balls = [];

  for (let i = 0; i < 3; i += 1) {
    const position = getSafeBallPosition(balls);
    balls.push(createBall(`${targetType}-target-${i + 1}`, targetType, position.x, position.y));
  }

  types.filter(type => type !== targetType).forEach((type, index) => {
    const position = getSafeBallPosition(balls);
    balls.push(createBall(`${type}-distractor-${index + 1}`, type, position.x, position.y));
  });

  return { balls, targetType };
};

// ======================================================
// 움직이는 목표 공 3개
// ======================================================
export const createMovingTargetBalls = () => {
  const balls = [];
  ["green", "blue", "pink"].forEach((type, index) => {
    const position = getSafeBallPosition(balls);
    balls.push(createBall(`moving-${type}-${index + 1}`, type, position.x, position.y));
  });
  return balls;
};

// ======================================================
// 20초 타임어택 공 3개
// ======================================================
export const createTimeAttackBalls = () => {
  const balls = [];
  const types = ["green", "blue", "pink"];

  for (let i = 0; i < 3; i += 1) {
    const type = types[Math.floor(Math.random() * types.length)];
    const position = getSafeBallPosition(balls);
    balls.push(createBall(`time-${i + 1}`, type, position.x, position.y));
  }

  return balls;
};