import React, { useEffect, useRef, useCallback, useState } from "react";
import { CONFIG } from "./constants/gameConfig";
import { getTargetZone, handleBallRelease, completeMission } from "./game/missionManager";
import { updateMovingTarget, updateGrabbedBalls, grabNearestBall } from "./game/ballManager";
import { renderGame } from "./game/canvasRenderer";
import { useHandTracking } from "./hooks/useHandTracking";
import { useGameLoop } from "./hooks/useGameLoop";
import { useGameState } from "./hooks/useGameState";

import CameraPreview from "./components/CameraPreview";
import GameDataPanel from "./components/GameDataPanel";
import GameOverlay from "./components/GameOverlay";
import GameControls from "./components/GameControls";
import MissionInstruction from "./components/MissionInstruction";
import ProgressBar from "./components/ProgressBar";
import QuitConfirmModal from "./components/QuitConfirmModal";
import "./RoutineGame.css";

const RoutineGame = () => {
  const canvasRef = useRef(null);

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

  const { refs, state, setters, initializeMission } = useGameState();

  const [isQuitModalOpen, setIsQuitModalOpen] = useState(false);

  const {
    isRunning,
    elapsedTime,
    successCount,
    mission,
    missionStatus,
    missionProgress,
    sequenceIndex,
    missionRemaining,
    isMissionComplete,
    isTerminated,
  } = state;

  // 1. 초기화
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      await initializeMediaPipe();
      if (isMounted) {
        await startCamera();
      }
    };

    init();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    initializeMission();
  }, []);

  // 2. 모달이 열리거나 닫힐 때 카메라 비디오 일시정지/재생 처리
  useEffect(() => {
    if (!videoRef.current) return;

    if (isQuitModalOpen) {
      // 모달이 열리면 비디오 화면 정지
      videoRef.current.pause();
    } else if (cameraReady && !isTerminated) {
      // 모달이 닫히면 비디오 다시 재생
      videoRef.current.play().catch(() => { });
    }
  }, [isQuitModalOpen, cameraReady, isTerminated, videoRef]);

  // 3. 타이머 (모달 열려있으면 멈춤)
  useEffect(() => {
    if (!isRunning || isQuitModalOpen) return;

    const timer = setInterval(() => {
      setters.setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, isQuitModalOpen, setters]);

  // 4. 게임 프레임 루프
  const handleFrame = useCallback(
    (timestamp) => {
      // 모달이 열려있지 않을 때만 손 인식 및 공 위치 업데이트
      if (isRunning && !isQuitModalOpen) {
        detectHands(timestamp);

        updateMovingTarget({ mission, movingTargetRef: refs.movingTargetRef });

        if (mission.type === "TIME_ATTACK" && missionStatus === "playing") {
          const elapsed = (timestamp - refs.missionStartTimeRef.current) / 1000;
          const remaining = Math.max(0, Math.ceil(CONFIG.timeAttackDuration - elapsed));
          setters.setMissionRemaining(remaining);

          if (remaining <= 0) {
            setters.setMissionStatus("failed");
            setters.setIsRunning(false);
          }
        }

        updateGrabbedBalls({
          balls: refs.ballsRef.current,
          hands: handsRef.current,
          now: timestamp,
          config: CONFIG,
          onRelease: (ball) => {
            const targetZone = getTargetZone({
              mission,
              movingTarget: refs.movingTargetRef.current,
              staticTargets: refs.staticTargetsRef.current,
            });

            handleBallRelease({
              ball,
              targetZone,
              mission,
              refs,
              setMissionProgress: setters.setMissionProgress,
              setSequenceIndex: setters.setSequenceIndex,
              completeMission: () =>
                completeMission({
                  setters,
                  initializeMission,
                }),
            });
          },
        });

        grabNearestBall({
          balls: refs.ballsRef.current,
          hands: handsRef.current,
          config: CONFIG,
          mission,
          sequenceOrder: refs.sequenceOrderRef.current,
          sequenceIndex,
          onInvalidSequence: () => { },
        });
      }

      // 화면 그리기는 지속
      renderGame({
        canvas: canvasRef.current,
        mission,
        movingTarget: refs.movingTargetRef.current,
        staticTargets: refs.staticTargetsRef.current,
        balls: refs.ballsRef.current,
        hands: handsRef.current,
      });
    },
    [
      isRunning,
      isQuitModalOpen,
      detectHands,
      mission,
      missionStatus,
      sequenceIndex,
      setters,
      initializeMission,
      refs,
      handsRef,
    ]
  );

  // 모달이 열리면 루프 자체를 멈춤 (!isQuitModalOpen)
  useGameLoop({
    enabled: cameraReady && isRunning && !isTerminated && !isQuitModalOpen,
    onFrame: handleFrame,
  });

  const handleStopGame = () => {
    setIsQuitModalOpen(true);
  };

  const handleConfirmQuit = () => {
    setIsQuitModalOpen(false);
    setters.setIsRunning(false);
    setters.setIsTerminated(true);
    cleanup(); // 카메라 및 손 추적 완전히 종료
  };

  const handleCloseModal = () => {
    setIsQuitModalOpen(false);
  };

  const resetGame = () => {
    initializeMission();
  };

  const isUIOverlayVisible = !isMissionComplete && !isTerminated;

  return (
    <div className="routine-game">

      <QuitConfirmModal
        isOpen={isQuitModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmQuit}
      />
      
      <div className="game-container">
        {isUIOverlayVisible && (
          <>
            <CameraPreview
              videoRef={videoRef}
              cameraReady={cameraReady}
              isTerminated={isTerminated}
            />
            <GameDataPanel
              elapsedTime={elapsedTime}
              successCount={successCount}
              handCount={handCount}
              screenDistance={screenDistance}
            />
            <MissionInstruction
              mission={mission}
              sequenceOrder={refs.sequenceOrderRef.current}
              sameColorTargetType={refs.sameColorTargetTypeRef.current}
              missionRemaining={missionRemaining}
            />
            <ProgressBar
              missionType={mission.type}
              sequenceIndex={sequenceIndex}
              missionProgress={missionProgress}
            />
          </>
        )}

        <div className="play-area">
          <canvas ref={canvasRef} />
        </div>

        <GameOverlay
          isMissionComplete={isMissionComplete}
          isTerminated={isTerminated}
          resetGame={resetGame}
        />
      </div>

      <GameControls
        handleStopGame={handleStopGame}
        resetGame={resetGame}
        isTerminated={isTerminated}
      />
    </div>
  );
};

export default RoutineGame;