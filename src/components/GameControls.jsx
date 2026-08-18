const GameControls = ({ handleStopGame, resetGame, isTerminated }) => {
  return (
    <div className="control-area">
      <button className="stop-button" onClick={handleStopGame}>종료</button>
      <button className="reset-button" onClick={resetGame} disabled={isTerminated}>초기화</button>
    </div>
  );
};

export default GameControls;