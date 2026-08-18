const GameOverlay = ({ isMissionComplete, isTerminated, resetGame }) => {
  return (
    <>
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
    </>
  );
};

export default GameOverlay;