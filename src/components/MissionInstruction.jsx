import React from "react";
import { BALL_TYPES } from "../constants/ballTypes";

const MissionInstruction = ({ mission, sequenceOrder, sameColorTargetType, missionRemaining }) => {
  const getMissionSubText = () => {
    switch (mission.type) {
      case "COLOR_SORT":
        return "공 3개를 각각 같은 색 영역에 넣어보세요";
      case "SEQUENCE": {
        const names = sequenceOrder.map((color) => BALL_TYPES[color]?.name);
        return `순서: ${names.join(" → ")}`;
      }
      case "MOVING_TARGET":
        return "공 3개를 움직이는 목표에 모두 넣어보세요";
      case "SAME_COLOR":
        return `${BALL_TYPES[sameColorTargetType]?.name} 공 3개를 모두 모아보세요`;
      case "TIME_ATTACK":
        return `${missionRemaining}초 안에 공 3개를 목표 영역으로 옮겨보세요`;
      default:
        return "";
    }
  };

  return (
    <div className="instruction">
      <span className="mission-text">{mission.title}</span>
      <span className="instruction-sub"> · {getMissionSubText()}</span>
    </div>
  );
};

export default MissionInstruction;