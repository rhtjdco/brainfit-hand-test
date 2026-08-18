import { BALL_TYPES } from "../constants/ballTypes";
import { CONFIG } from "../constants/gameConfig";
import {
  getDistance,
  createNormalBalls,
  createSameColorBalls,
  createMovingTargetBalls,
  createTimeAttackBalls,
} from "../utils";

// 미션 초기화
export const setupMission = ({
  nextMission,
  refs,
  setMissionProgress,
  setSequenceIndex,
  setMissionRemaining,
  setMissionStatus,
  setIsRunning,
  setIsMissionComplete,
  setIsTerminated,
}) => {
  const {
    missionRef,
    missionProgressRef,
    sequenceIndexRef,
    sequenceOrderRef,
    missionStartTimeRef,
    movingTargetRef,
    sameColorTargetTypeRef,
    staticTargetsRef,
    ballsRef,
  } = refs;

  missionRef.current = nextMission;
  missionProgressRef.current = 0;
  sequenceIndexRef.current = 0;
  missionStartTimeRef.current = performance.now();

  setMissionProgress(0);
  setSequenceIndex(0);
  setMissionRemaining(
    nextMission.type === "TIME_ATTACK" ? CONFIG.timeAttackDuration : 60
  );
  setMissionStatus("playing");
  setIsRunning(true);
  setIsMissionComplete(false);
  setIsTerminated(false);

  // 1. SAME_COLOR
  if (nextMission.type === "SAME_COLOR") {
    const sameColor = createSameColorBalls();
    sameColorTargetTypeRef.current = sameColor.targetType;
    ballsRef.current = sameColor.balls;

    staticTargetsRef.current = [
      {
        id: "single",
        x: 0.2 + Math.random() * 0.6,
        y: 0.55 + Math.random() * 0.15,
        radius: 0.13,
        color: BALL_TYPES[sameColor.targetType]?.color || "#8EA9B8",
        label: "모으기",
      },
    ];
    return;
  }

  // 2. MOVING_TARGET
  if (nextMission.type === "MOVING_TARGET") {
    ballsRef.current = createMovingTargetBalls();
    movingTargetRef.current = {
      x: 0.22 + Math.random() * 0.56,
      y: 0.28 + Math.random() * 0.28,
      radius: 0.11,
      color: "#BBBBBB",
      label: "목표",
      vx: (Math.random() > 0.5 ? 1 : -1) * 0.00042,
      vy: (Math.random() > 0.5 ? 1 : -1) * 0.00024,
    };
    return;
  }

  // 3. TIME_ATTACK
  if (nextMission.type === "TIME_ATTACK") {
    ballsRef.current = createTimeAttackBalls();
    staticTargetsRef.current = [
      {
        id: "single",
        x: 0.2 + Math.random() * 0.6,
        y: 0.55 + Math.random() * 0.15,
        radius: 0.12,
        color: "#8EA9B8",
        label: "목표",
      },
    ];
    return;
  }

  // 4. SEQUENCE
  if (nextMission.type === "SEQUENCE") {
    ballsRef.current = createNormalBalls();
    sequenceOrderRef.current = ["green", "blue", "pink"].sort(
      () => Math.random() - 0.5
    );
    staticTargetsRef.current = [];
    return;
  }

  // 5. COLOR_SORT (기본)
  ballsRef.current = createNormalBalls();
  const xs = [0.25, 0.5, 0.75].sort(() => Math.random() - 0.5);

  staticTargetsRef.current = [
    {
      id: "green",
      x: xs[0],
      y: 0.55 + Math.random() * 0.15,
      radius: 0.11,
      color: BALL_TYPES.green.color,
      label: "초록",
    },
    {
      id: "blue",
      x: xs[1],
      y: 0.55 + Math.random() * 0.15,
      radius: 0.11,
      color: BALL_TYPES.blue.color,
      label: "파랑",
    },
    {
      id: "pink",
      x: xs[2],
      y: 0.55 + Math.random() * 0.15,
      radius: 0.11,
      color: BALL_TYPES.pink.color,
      label: "핑크",
    },
  ];
};

// 목표 영역 찾기
export const getTargetZone = ({
  mission,
  ball,
  movingTargetRef,
  staticTargetsRef,
}) => {
  if (mission.type === "MOVING_TARGET") {
    return { ...movingTargetRef.current };
  }

  if (mission.type === "COLOR_SORT") {
    return (
      staticTargetsRef.current.find((target) => target.id === ball.type) ||
      staticTargetsRef.current[0]
    );
  }

  return staticTargetsRef.current[0];
};

// 영역 내부 확인
export const isInsideTarget = (ball, target) => {
  if (!target) return false;
  return getDistance(ball, target) < target.radius;
};

// 미션 성공 처리
export const completeMission = ({
  setSuccessCount,
  setIsMissionComplete,
  setIsRunning,
}) => {
  setSuccessCount((previous) => previous + 1);
  setIsMissionComplete(true);
  setIsRunning(false);
};

// 공 놓기 후 판정
export const handleBallRelease = ({
  mission,
  ball,
  target,
  refs,
  callbacks,
}) => {
  const {
    missionProgressRef,
    sequenceIndexRef,
    sequenceOrderRef,
    sameColorTargetTypeRef,
  } = refs;

  const {
    setMissionProgress,
    setSequenceIndex,
    completeMission,
    failMission,
  } = callbacks;

  const insideTarget = isInsideTarget(ball, target);

  // COLOR_SORT
  if (mission.type === "COLOR_SORT") {
    if (!insideTarget) return;

    missionProgressRef.current += 1;
    setMissionProgress(missionProgressRef.current);
    ball.x = -1;
    ball.y = -1;

    if (missionProgressRef.current >= 3) {
      completeMission();
    }
    return;
  }

  // SEQUENCE
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

    if (sequenceIndexRef.current >= sequence.length) {
      completeMission();
    }
    return;
  }

  // MOVING_TARGET / TIME_ATTACK
  if (mission.type === "MOVING_TARGET" || mission.type === "TIME_ATTACK") {
    if (!insideTarget) return;

    missionProgressRef.current += 1;
    setMissionProgress(missionProgressRef.current);
    ball.x = -1;
    ball.y = -1;

    if (missionProgressRef.current >= 3) {
      completeMission();
    }
    return;
  }

  // SAME_COLOR
  if (mission.type === "SAME_COLOR") {
    if (ball.type !== sameColorTargetTypeRef.current || !insideTarget) return;

    missionProgressRef.current += 1;
    setMissionProgress(missionProgressRef.current);
    ball.x = -1;
    ball.y = -1;

    if (missionProgressRef.current >= 3) {
      completeMission();
    }
  }
};