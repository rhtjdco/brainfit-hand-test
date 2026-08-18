import { formatTime } from "../utils";

const GameDataPanel = ({ elapsedTime, successCount, handCount, screenDistance }) => {
  return (
    <>
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
            <strong className={screenDistance?.status === "적정" ? "distance-good" : "distance-warning"}>
              {screenDistance?.status ?? "인식되지 않음"}
            </strong>
          </div>

          {screenDistance?.status && screenDistance.status !== "인식되지 않음" && (
            <div className="distance-bar">
              <div className="distance-marker" style={{ left: `${screenDistance.value}%` }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GameDataPanel;