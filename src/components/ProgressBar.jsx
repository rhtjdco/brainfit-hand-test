import React from "react";

const ProgressBar = ({ missionType, sequenceIndex, missionProgress }) => {
  const progressPercent = ((missionType === "SEQUENCE" ? sequenceIndex : missionProgress) / 3) * 100;

  return (
    <div className="progress-section">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="steps">
        <span>STEP 1</span>
        <span>STEP 2</span>
        <span>STEP 3</span>
        <span>STEP 4</span>
      </div>
    </div>
  );
};

export default ProgressBar;