import React from "react";
import "./QuitConfirmModal.css";

const QuitConfirmModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-icon">!</div>
        <h2 className="modal-title">
          지금 종료하면<br />다음 세션으로 넘어갈 수 없어요
        </h2>
        <p className="modal-description">모든 단계를 완료해주세요</p>
        <div className="modal-buttons">
          <button className="btn-close" onClick={onClose}>
            닫기
          </button>
          <button className="btn-confirm" onClick={onConfirm}>
            종료
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuitConfirmModal;