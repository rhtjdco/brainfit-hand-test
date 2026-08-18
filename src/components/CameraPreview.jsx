const CameraPreview = ({ videoRef, cameraReady, isTerminated }) => {
  return (
    <div className="camera-preview">
      <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
      {!cameraReady && !isTerminated && (
        <div className="camera-loading">카메라 준비 중...</div>
      )}
    </div>
  );
};

export default CameraPreview;