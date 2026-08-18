import { getDistance, lerp } from "../utils";
import { CONFIG } from "../constants/gameConfig";

// 헬퍼: 0.05 ~ 0.95 범위 제한
const clampPosition = (val) => Math.max(0.05, Math.min(0.95, val));

export const updateMovingTarget = ({ mission, movingTargetRef }) => {
  if (!mission || mission.type !== "MOVING_TARGET") return;
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
};

export const updateGrabbedBalls = ({ balls, hands, now, onRelease }) => {
  balls.forEach((ball) => {
    if (!ball.grabbed) return;

    const hand = hands.find((candidate) => candidate.id === ball.grabbedBy);

    // 손을 놓친 경우
    if (!hand) {
      ball.grabbed = false;
      ball.grabbedBy = null;
      ball.releaseStartTime = null;
      return;
    }

    // 주먹을 쥐고 있으면 손 따라 이동
    if (hand.fist) {
      ball.releaseStartTime = null;
      const targetX = hand.x + ball.grabOffsetX;
      const targetY = hand.y + ball.grabOffsetY;

      ball.x = clampPosition(lerp(ball.x, targetX, CONFIG.ballFollowSmooth));
      ball.y = clampPosition(lerp(ball.y, targetY, CONFIG.ballFollowSmooth));
      return;
    }

    // 손을 폈을 때 release timer 시작
    if (ball.releaseStartTime === null) {
      ball.releaseStartTime = now;
      return;
    }

    // 일정 시간 손을 편 상태면 공 놓기
    if (now - ball.releaseStartTime >= CONFIG.ballReleaseDelay) {
      ball.grabbed = false;
      ball.grabbedBy = null;
      ball.releaseStartTime = null;

      onRelease(ball);
    }
  });
};

export const grabNearestBall = ({
  balls,
  hands,
  mission,
  sequenceOrder,
  sequenceIndex,
  onInvalidSequence,
}) => {
  const occupiedHandIds = new Set(
    balls.filter((b) => b.grabbed && b.grabbedBy).map((b) => b.grabbedBy)
  );

  const availableHands = hands
    .filter((hand) => hand.fistJustClosed)
    .filter((hand) => !occupiedHandIds.has(hand.id));

  availableHands.forEach((hand) => {
    let nearestBall = null;
    let nearestDistance = Infinity;

    balls.forEach((ball) => {
      if (ball.grabbed || ball.x < 0) return;

      const distance = getDistance(hand, ball);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBall = ball;
      }
    });

    if (!nearestBall || nearestDistance >= CONFIG.ballGrabDistance) return;

    // SEQUENCE 미션 검사
    if (mission.type === "SEQUENCE") {
      const expected = sequenceOrder[sequenceIndex];
      if (nearestBall.type !== expected) {
        onInvalidSequence();
        return;
      }
    }

    nearestBall.grabbed = true;
    nearestBall.grabbedBy = hand.id;
    nearestBall.grabOffsetX = nearestBall.x - hand.x;
    nearestBall.grabOffsetY = nearestBall.y - hand.y;

    occupiedHandIds.add(hand.id);
  });
};