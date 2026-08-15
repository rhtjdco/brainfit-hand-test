import React, { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    HandLandmarker,
    FaceDetector,
} from "@mediapipe/tasks-vision";


// ======================================================
// 시간 포맷
// ======================================================

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
};


// ======================================================
// 선형 보간
// ======================================================

const lerp = (current, target, amount) => {
    return current + (target - current) * amount;
};


// ======================================================
// 거리 계산
// ======================================================

const getDistance = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);
};


// ======================================================
// MAIN
// ======================================================

function RoutineGame() {

    // ==================================================
    // DOM
    // ==================================================

    const videoRef = useRef(null);
    const canvasRef = useRef(null);


    // ==================================================
    // MediaPipe
    // ==================================================

    const handLandmarkerRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const streamRef = useRef(null);


    // ==================================================
    // Animation
    // ==================================================

    const animationRef = useRef(null);


    // ==================================================
    // 손
    // ==================================================

    const handsRef = useRef([]);


    // ==================================================
    // 거리
    // ==================================================

    const distanceRef = useRef({
        value: 50,
        status: "적정",
    });

    const lastDistanceUpdateRef = useRef(0);


    // ==================================================
    // 공 초기값
    // ==================================================

    const createInitialBalls = () => [
        {
            id: 0,

            x: 0.42,
            y: 0.32,

            radius: 42,

            color: "#8EA9B8",

            grabbed: false,
            grabbedBy: null,

            grabOffsetX: 0,
            grabOffsetY: 0,

            releaseStartTime: null,

            targetX: 0.42,
            targetY: 0.32,
        },

        {
            id: 1,

            x: 0.58,
            y: 0.50,

            radius: 42,

            color: "#7C73A7",

            grabbed: false,
            grabbedBy: null,

            grabOffsetX: 0,
            grabOffsetY: 0,

            releaseStartTime: null,

            targetX: 0.58,
            targetY: 0.50,
        },
    ];


    const ballsRef = useRef(
        createInitialBalls()
    );


    // ==================================================
    // State
    // ==================================================

    const [cameraReady, setCameraReady] =
        useState(false);

    const [isRunning, setIsRunning] =
        useState(true);

    const [timeLeft, setTimeLeft] =
        useState(180);

    const [score, setScore] =
        useState(0);

    const [handCount, setHandCount] =
        useState(0);

    const [step, setStep] =
        useState(1);

    const [screenDistance, setScreenDistance] =
        useState({
            value: 50,
            status: "적정",
        });


    // ==================================================
    // 설정
    // ==================================================

    const CONFIG = {

        // 손 움직임 부드러움
        positionSmooth: 0.30,

        // 주먹 판정
        fistEnterThreshold: 3.7,
        fistExitThreshold: 2.4,

        // 공을 잡을 수 있는 거리
        grabDistance: 0.09,

        // 공이 손을 따라가는 속도
        ballFollowSmooth: 0.24,

        // 손을 폈을 때 공을 놓기까지
        releaseDelay: 100,

        // 손 인식이 잠깐 끊겨도 유지
        lostHandGraceTime: 500,

        // 거리 업데이트
        distanceUpdateInterval: 100,
    };


    // ==================================================
    // 손바닥 중심
    // ==================================================

    const getPalmCenter = (landmarks) => {

        const points = [
            landmarks[0],
            landmarks[5],
            landmarks[9],
            landmarks[13],
            landmarks[17],
        ];

        let x = 0;
        let y = 0;

        points.forEach((point) => {
            x += point.x;
            y += point.y;
        });

        return {
            x: x / points.length,
            y: y / points.length,
        };
    };


    // ==================================================
    // 주먹 점수
    // ==================================================

    const getFistScore = (landmarks) => {

        const wrist = landmarks[0];

        const fingers = [
            {
                mcp: 5,
                pip: 6,
                dip: 7,
                tip: 8,
            },

            {
                mcp: 9,
                pip: 10,
                dip: 11,
                tip: 12,
            },

            {
                mcp: 13,
                pip: 14,
                dip: 15,
                tip: 16,
            },

            {
                mcp: 17,
                pip: 18,
                dip: 19,
                tip: 20,
            },
        ];

        let score = 0;

        fingers.forEach(
            ({
                mcp,
                pip,
                dip,
                tip,
            }) => {

                const mcpDistance =
                    getDistance(
                        landmarks[mcp],
                        wrist
                    );

                const pipDistance =
                    getDistance(
                        landmarks[pip],
                        wrist
                    );

                const dipDistance =
                    getDistance(
                        landmarks[dip],
                        wrist
                    );

                const tipDistance =
                    getDistance(
                        landmarks[tip],
                        wrist
                    );


                if (
                    tipDistance <
                    mcpDistance * 1.35
                ) {
                    score += 0.75;
                }


                if (
                    tipDistance <
                    pipDistance * 1.25
                ) {
                    score += 0.5;
                }


                if (
                    tipDistance <
                    dipDistance * 1.18
                ) {
                    score += 0.35;
                }
            }
        );

        return score;
    };


    // ==================================================
    // 주먹 상태
    // ==================================================

    const updateFistState = (
        previous,
        score
    ) => {

        if (previous) {
            return (
                score >
                CONFIG.fistExitThreshold
            );
        }

        return (
            score >
            CONFIG.fistEnterThreshold
        );
    };


    // ==================================================
    // 안정적인 손 위치
    // ==================================================

    const getStableHandPosition = (
        landmarks,
        previousHand
    ) => {

        const palm =
            getPalmCenter(landmarks);

        const wrist =
            landmarks[0];

        const middleBase =
            landmarks[9];


        const stableX =
            palm.x * 0.65 +
            middleBase.x * 0.25 +
            wrist.x * 0.10;


        const stableY =
            palm.y * 0.65 +
            middleBase.y * 0.25 +
            wrist.y * 0.10;


        const targetX =
            1 - stableX;

        const targetY =
            stableY;


        if (!previousHand) {
            return {
                x: targetX,
                y: targetY,
            };
        }


        return {
            x: lerp(
                previousHand.x,
                targetX,
                CONFIG.positionSmooth
            ),

            y: lerp(
                previousHand.y,
                targetY,
                CONFIG.positionSmooth
            ),
        };
    };


    // ==================================================
    // 카메라 시작
    // ==================================================

    const startCamera = async () => {

        try {

            const stream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        video: {
                            width: 1280,
                            height: 720,
                            facingMode: "user",
                        },

                        audio: false,
                    }
                );


            streamRef.current =
                stream;


            if (!videoRef.current) {
                return;
            }


            videoRef.current.srcObject =
                stream;


            await new Promise(
                (resolve) => {

                    videoRef.current.onloadedmetadata =
                        resolve;

                }
            );


            await videoRef.current.play();


            setCameraReady(true);


            console.log(
                "카메라 시작 성공"
            );

        } catch (error) {

            console.error(
                "카메라 시작 실패:",
                error
            );

        }
    };


    // ==================================================
    // MediaPipe 초기화
    // ==================================================

    const initializeMediaPipe =
        async () => {

            try {

                const vision =
                    await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
                    );


                // ======================================
                // Hand Landmarker
                // ======================================

                const handLandmarker =
                    await HandLandmarker.createFromOptions(
                        vision,
                        {
                            baseOptions: {

                                modelAssetPath:
                                    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",

                                delegate:
                                    "GPU",
                            },

                            runningMode:
                                "VIDEO",

                            numHands: 2,

                            minHandDetectionConfidence:
                                0.55,

                            minHandPresenceConfidence:
                                0.55,

                            minTrackingConfidence:
                                0.55,
                        }
                    );


                handLandmarkerRef.current =
                    handLandmarker;


                // ======================================
                // Face Detector
                // ======================================

                const faceDetector =
                    await FaceDetector.createFromOptions(
                        vision,
                        {
                            baseOptions: {

                                modelAssetPath:
                                    "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",

                                delegate:
                                    "GPU",
                            },

                            runningMode:
                                "VIDEO",

                            minDetectionConfidence:
                                0.5,
                        }
                    );


                faceDetectorRef.current =
                    faceDetector;


                console.log(
                    "MediaPipe 초기화 성공"
                );

            } catch (error) {

                console.error(
                    "MediaPipe 초기화 실패:",
                    error
                );

            }
        };


    // ==================================================
    // 화면 거리 측정
    // ==================================================

    const detectScreenDistance = (
        video,
        timestamp
    ) => {

        if (
            !faceDetectorRef.current ||
            !video ||
            !video.videoWidth
        ) {
            return;
        }


        try {

            const result =
                faceDetectorRef.current.detectForVideo(
                    video,
                    timestamp
                );


            if (
                !result.detections ||
                result.detections.length === 0
            ) {
                return;
            }


            const detection =
                result.detections.reduce(
                    (
                        largest,
                        current
                    ) => {

                        const largestBox =
                            largest.boundingBox;

                        const currentBox =
                            current.boundingBox;


                        const largestArea =
                            largestBox.width *
                            largestBox.height;


                        const currentArea =
                            currentBox.width *
                            currentBox.height;


                        return (
                            currentArea >
                            largestArea
                        )
                            ? current
                            : largest;
                    }
                );


            const box =
                detection.boundingBox;


            const widthRatio =
                box.width /
                video.videoWidth;


            // =========================================
            // 거리 기준
            //
            // 0.28 이상 : 너무 가까움
            // 0.10~0.28 : 적정
            // 0.10 이하 : 너무 멂
            // =========================================

            let status;
            let value;


            if (
                widthRatio >= 0.28
            ) {

                status =
                    "너무 가까움";


                value =
                    72 +
                    Math.min(
                        28,
                        (
                            widthRatio -
                            0.28
                        ) * 140
                    );

            } else if (
                widthRatio >= 0.10
            ) {

                status =
                    "적정";


                value =
                    30 +
                    (
                        (
                            0.28 -
                            widthRatio
                        ) /
                        0.18
                    ) * 40;

            } else {

                status =
                    "너무 멂";


                value =
                    Math.max(
                        0,
                        30 -
                        (
                            0.10 -
                            widthRatio
                        ) * 120
                    );
            }


            value =
                Math.max(
                    0,
                    Math.min(
                        100,
                        value
                    )
                );


            const previous =
                distanceRef.current.value;


            const smoothValue =
                previous * 0.8 +
                value * 0.2;


            distanceRef.current = {
                value:
                    smoothValue,

                status:
                    status,
            };


            if (
                timestamp -
                    lastDistanceUpdateRef.current >=
                CONFIG.distanceUpdateInterval
            ) {

                lastDistanceUpdateRef.current =
                    timestamp;


                setScreenDistance({
                    value:
                        smoothValue,

                    status:
                        status,
                });
            }

        } catch (error) {

            console.error(
                "거리 측정 오류:",
                error
            );

        }
    };


    // ==================================================
    // 손 인식
    // ==================================================

    const detectHands = (
        timestamp
    ) => {

        if (
            !videoRef.current ||
            !handLandmarkerRef.current ||
            videoRef.current.readyState < 2
        ) {
            return;
        }


        try {

            detectScreenDistance(
                videoRef.current,
                timestamp
            );


            const result =
                handLandmarkerRef.current.detectForVideo(
                    videoRef.current,
                    timestamp
                );


            const previousHands =
                handsRef.current;


            const detectedHands = [];


            if (
                result.landmarks
            ) {

                result.landmarks.forEach(
                    (landmarks) => {

                        const palm =
                            getPalmCenter(
                                landmarks
                            );


                        const rawX =
                            1 - palm.x;


                        const rawY =
                            palm.y;


                        let previousHand =
                            null;


                        let closest =
                            Infinity;


                        previousHands.forEach(
                            (hand) => {

                                const distance =
                                    Math.sqrt(
                                        Math.pow(
                                            hand.x -
                                            rawX,
                                            2
                                        ) +
                                        Math.pow(
                                            hand.y -
                                            rawY,
                                            2
                                        )
                                    );


                                if (
                                    distance <
                                    closest
                                ) {

                                    closest =
                                        distance;

                                    previousHand =
                                        hand;
                                }

                            }
                        );


                        if (
                            closest > 0.40
                        ) {

                            previousHand =
                                null;
                        }


                        const position =
                            getStableHandPosition(
                                landmarks,
                                previousHand
                            );


                        const fistScore =
                            getFistScore(
                                landmarks
                            );


                        const fist =
                            updateFistState(
                                previousHand?.fist ??
                                    false,
                                fistScore
                            );


                        detectedHands.push({

                            id:
                                previousHand?.id ??
                                `hand-${Date.now()}-${Math.random()}`,

                            x:
                                position.x,

                            y:
                                position.y,

                            fist:
                                fist,

                            fistScore:
                                fistScore,

                            landmarks:
                                landmarks,

                            lastSeen:
                                timestamp,
                        });

                    }
                );

            }


            // ==================================================
            // 손이 잠깐 사라져도 유지
            // ==================================================

            const finalHands = [
                ...detectedHands,
            ];


            previousHands.forEach(
                (previous) => {

                    const exists =
                        finalHands.some(
                            (hand) =>
                                hand.id ===
                                previous.id
                        );


                    if (
                        !exists &&
                        timestamp -
                            previous.lastSeen <
                            CONFIG.lostHandGraceTime
                    ) {

                        finalHands.push({
                            ...previous,
                        });

                    }

                }
            );


            handsRef.current =
                finalHands;


            setHandCount(
                detectedHands.length
            );

        } catch (error) {

            console.error(
                "손 인식 오류:",
                error
            );

        }
    };


    // ==================================================
    // 공 업데이트
    // ==================================================

    const updateBalls = (now) => {

        const balls =
            ballsRef.current;


        const hands =
            handsRef.current;


        const currentlyHoldingHands =
            new Set();


        // ==================================================
        // 이미 잡힌 공
        // ==================================================

        balls.forEach((ball) => {

            if (
                !ball.grabbed
            ) {
                return;
            }


            let hand =
                hands.find(
                    (item) =>
                        item.id ===
                        ball.grabbedBy
                );


            // ==================================================
            // 기존 손 ID가 사라졌으면
            // 가까운 손 다시 검색
            // ==================================================

            if (!hand) {

                let nearestHand =
                    null;


                let nearestDistance =
                    Infinity;


                hands.forEach(
                    (candidate) => {

                        if (
                            !candidate.fist
                        ) {
                            return;
                        }


                        const distance =
                            getDistance(
                                candidate,
                                ball
                            );


                        if (
                            distance <
                            nearestDistance
                        ) {

                            nearestDistance =
                                distance;

                            nearestHand =
                                candidate;
                        }

                    }
                );


                if (
                    nearestHand &&
                    nearestDistance <
                        CONFIG.grabDistance * 2.5
                ) {

                    hand =
                        nearestHand;


                    ball.grabbedBy =
                        nearestHand.id;


                    ball.grabOffsetX =
                        ball.x -
                        nearestHand.x;


                    ball.grabOffsetY =
                        ball.y -
                        nearestHand.y;
                }
            }


            // ==================================================
            // 손을 완전히 놓쳤으면
            // 공은 현재 위치에서 멈춤
            // ==================================================

            if (!hand) {
                return;
            }


            currentlyHoldingHands.add(
                hand.id
            );


            // ==================================================
            // 주먹 유지
            // ==================================================

            if (
                hand.fist
            ) {

                ball.releaseStartTime =
                    null;


                ball.targetX =
                    hand.x +
                    ball.grabOffsetX;


                ball.targetY =
                    hand.y +
                    ball.grabOffsetY;


                ball.x =
                    lerp(
                        ball.x,
                        ball.targetX,
                        CONFIG.ballFollowSmooth
                    );


                ball.y =
                    lerp(
                        ball.y,
                        ball.targetY,
                        CONFIG.ballFollowSmooth
                    );


                return;
            }


            // ==================================================
            // 손을 펴면 놓기
            // ==================================================

            if (
                ball.releaseStartTime ===
                null
            ) {

                ball.releaseStartTime =
                    now;

                return;
            }


            const releaseDuration =
                now -
                ball.releaseStartTime;


            if (
                releaseDuration >=
                CONFIG.releaseDelay
            ) {

                ball.grabbed =
                    false;


                ball.grabbedBy =
                    null;


                ball.releaseStartTime =
                    null;


                setScore(
                    (prev) =>
                        prev + 1
                );


                setStep(
                    (prev) => {

                        if (
                            prev >= 4
                        ) {
                            return 1;
                        }

                        return prev + 1;
                    }
                );


                // ==================================================
                // 놓은 공은 화면 아래쪽에서도 등장 가능
                // ==================================================

                ball.x =
                    0.15 +
                    Math.random() * 0.70;


                ball.y =
                    0.20 +
                    Math.random() * 0.65;


                ball.targetX =
                    ball.x;


                ball.targetY =
                    ball.y;
            }

        });


        // ==================================================
        // 아직 잡히지 않은 공
        // ==================================================

        balls.forEach((ball) => {

            if (
                ball.grabbed
            ) {
                return;
            }


            let nearestHand =
                null;


            let nearestDistance =
                Infinity;


            hands.forEach((hand) => {

                // 이미 다른 공을 잡고 있는 손
                if (
                    currentlyHoldingHands.has(
                        hand.id
                    )
                ) {
                    return;
                }


                // 주먹이 아니면 잡을 수 없음
                if (
                    !hand.fist
                ) {
                    return;
                }


                const distance =
                    getDistance(
                        hand,
                        ball
                    );


                if (
                    distance <
                    nearestDistance
                ) {

                    nearestDistance =
                        distance;


                    nearestHand =
                        hand;
                }

            });


            // ==================================================
            // 반드시
            // 주먹 + 공 위
            // 두 조건을 만족해야 잡힘
            // ==================================================

            if (
                nearestHand &&
                nearestHand.fist &&
                nearestDistance <
                    CONFIG.grabDistance
            ) {

                ball.grabbed =
                    true;


                ball.grabbedBy =
                    nearestHand.id;


                ball.releaseStartTime =
                    null;


                ball.grabOffsetX =
                    ball.x -
                    nearestHand.x;


                ball.grabOffsetY =
                    ball.y -
                    nearestHand.y;


                currentlyHoldingHands.add(
                    nearestHand.id
                );
            }

        });
    };


    // ==================================================
    // 공 그리기
    // ==================================================

    const drawBall = (
        ctx,
        ball,
        width,
        height
    ) => {

        const x =
            ball.x * width;


        const y =
            ball.y * height;


        const radius =
            ball.radius;


        ctx.save();


        // 그림자

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );


        ctx.shadowColor =
            "rgba(0,0,0,0.45)";


        ctx.shadowBlur =
            16;


        const gradient =
            ctx.createRadialGradient(
                x - radius * 0.35,
                y - radius * 0.35,
                radius * 0.08,

                x,
                y,
                radius
            );


        gradient.addColorStop(
            0,
            "#F4FAFF"
        );


        gradient.addColorStop(
            0.22,
            ball.color
        );


        gradient.addColorStop(
            0.75,
            ball.color
        );


        gradient.addColorStop(
            1,
            "#4D5660"
        );


        ctx.fillStyle =
            gradient;


        ctx.fill();


        ctx.restore();


        // 하이라이트

        ctx.beginPath();

        ctx.arc(
            x - radius * 0.28,
            y - radius * 0.30,
            radius * 0.055,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            "rgba(255,255,255,0.85)";


        ctx.fill();


        // 잡힌 공 표시

        if (
            ball.grabbed
        ) {

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                radius + 7,
                0,
                Math.PI * 2
            );


            ctx.strokeStyle =
                "rgba(255,255,255,0.8)";


            ctx.lineWidth =
                2;


            ctx.stroke();
        }
    };


    // ==================================================
    // 손 포인터
    // ==================================================

    const drawHandPoints = (
        ctx,
        width,
        height
    ) => {

        handsRef.current.forEach(
            (hand) => {

                const x =
                    hand.x * width;


                const y =
                    hand.y * height;


                // ======================================
                // 바깥 원
                // ======================================

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    14,
                    0,
                    Math.PI * 2
                );


                ctx.fillStyle =
                    hand.fist
                        ? "rgba(233,155,155,0.14)"
                        : "rgba(255,255,255,0.08)";


                ctx.fill();


                // ======================================
                // 중심 포인터
                // ======================================

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    5,
                    0,
                    Math.PI * 2
                );


                ctx.fillStyle =
                    hand.fist
                        ? "#E99B9B"
                        : "#FFFFFF";


                ctx.fill();


                // ======================================
                // 포인터 테두리
                // ======================================

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    8,
                    0,
                    Math.PI * 2
                );


                ctx.strokeStyle =
                    hand.fist
                        ? "rgba(233,155,155,0.8)"
                        : "rgba(255,255,255,0.75)";


                ctx.lineWidth =
                    1.5;


                ctx.stroke();


                // ======================================
                // 가장 가까운 공
                // ======================================

                let targetBall =
                    null;


                let nearestDistance =
                    Infinity;


                ballsRef.current.forEach(
                    (ball) => {

                        const ballX =
                            ball.x *
                            width;


                        const ballY =
                            ball.y *
                            height;


                        const distance =
                            Math.sqrt(
                                Math.pow(
                                    x -
                                    ballX,
                                    2
                                ) +
                                Math.pow(
                                    y -
                                    ballY,
                                    2
                                )
                            );


                        if (
                            distance <
                            nearestDistance
                        ) {

                            nearestDistance =
                                distance;


                            targetBall =
                                ball;
                        }

                    }
                );


                // ======================================
                // 공 근처일 때 시각적 표시
                // ======================================

                if (
                    targetBall &&
                    nearestDistance <
                        targetBall.radius * 1.35
                ) {

                    const ballX =
                        targetBall.x *
                        width;


                    const ballY =
                        targetBall.y *
                        height;


                    // 연결선

                    ctx.beginPath();

                    ctx.moveTo(
                        x,
                        y
                    );


                    ctx.lineTo(
                        ballX,
                        ballY
                    );


                    ctx.strokeStyle =
                        targetBall.grabbed
                            ? "rgba(255,255,255,0.6)"
                            : "rgba(255,255,255,0.25)";


                    ctx.lineWidth =
                        1;


                    ctx.setLineDash([
                        4,
                        5
                    ]);


                    ctx.stroke();


                    ctx.setLineDash([]);


                    // 공 주변 링

                    ctx.beginPath();

                    ctx.arc(
                        ballX,
                        ballY,
                        targetBall.radius + 8,
                        0,
                        Math.PI * 2
                    );


                    ctx.strokeStyle =
                        targetBall.grabbed
                            ? "rgba(255,255,255,0.85)"
                            : (
                                hand.fist
                                    ? "rgba(233,155,155,0.7)"
                                    : "rgba(255,255,255,0.35)"
                            );


                    ctx.lineWidth =
                        1.5;


                    ctx.stroke();
                }

            }
        );
    };


    // ==================================================
    // Canvas 렌더링
    // ==================================================

    const renderGame = () => {

        const canvas =
            canvasRef.current;


        if (!canvas) {
            return;
        }


        const container =
            canvas.parentElement;


        if (!container) {
            return;
        }


        const width =
            container.clientWidth;


        const height =
            container.clientHeight;


        if (
            width <= 0 ||
            height <= 0
        ) {
            return;
        }


        const dpr =
            window.devicePixelRatio || 1;


        if (
            canvas.width !== width * dpr ||
            canvas.height !== height * dpr
        ) {

            canvas.width =
                width * dpr;


            canvas.height =
                height * dpr;


            canvas.style.width =
                `${width}px`;


            canvas.style.height =
                `${height}px`;
        }


        const ctx =
            canvas.getContext("2d");


        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        // 공

        ballsRef.current.forEach(
            (ball) => {

                drawBall(
                    ctx,
                    ball,
                    width,
                    height
                );

            }
        );


        // 손 포인터

        drawHandPoints(
            ctx,
            width,
            height
        );
    };


    // ==================================================
    // 게임 루프
    // ==================================================

    const gameLoop = (
        timestamp
    ) => {

        if (
            isRunning
        ) {

            detectHands(
                timestamp
            );


            updateBalls(
                timestamp
            );
        }


        renderGame();


        animationRef.current =
            requestAnimationFrame(
                gameLoop
            );
    };


    // ==================================================
    // 초기화
    // ==================================================

    useEffect(() => {

        let mounted = true;


        const initialize =
            async () => {

                await initializeMediaPipe();


                if (
                    mounted
                ) {

                    await startCamera();
                }

            };


        initialize();


        return () => {

            mounted =
                false;


            if (
                animationRef.current
            ) {

                cancelAnimationFrame(
                    animationRef.current
                );
            }


            if (
                streamRef.current
            ) {

                streamRef.current
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );
            }

        };

    }, []);


    // ==================================================
    // 게임 루프 시작
    // ==================================================

    useEffect(() => {

        if (
            !cameraReady
        ) {
            return;
        }


        animationRef.current =
            requestAnimationFrame(
                gameLoop
            );


        return () => {

            if (
                animationRef.current
            ) {

                cancelAnimationFrame(
                    animationRef.current
                );
            }

        };

    }, [
        cameraReady,
        isRunning,
    ]);


    // ==================================================
    // 타이머
    // ==================================================

    useEffect(() => {

        if (
            !isRunning
        ) {
            return;
        }


        const timer =
            setInterval(
                () => {

                    setTimeLeft(
                        (prev) => {

                            if (
                                prev <= 1
                            ) {

                                setIsRunning(
                                    false
                                );


                                return 0;
                            }


                            return prev - 1;
                        }
                    );

                },
                1000
            );


        return () =>
            clearInterval(
                timer
            );

    }, [
        isRunning,
    ]);


    // ==================================================
    // 초기화
    // ==================================================

    const resetGame = () => {

        setTimeLeft(180);

        setScore(0);

        setStep(1);

        setIsRunning(true);


        handsRef.current =
            [];


        distanceRef.current = {
            value: 50,
            status: "적정",
        };


        setScreenDistance({
            value: 50,
            status: "적정",
        });


        ballsRef.current =
            createInitialBalls();
    };


    // ==================================================
    // 진행률
    // ==================================================

    const progress =
        (
            (180 - timeLeft) /
            180
        ) * 100;


    // ==================================================
    // JSX
    // ==================================================

    return (

        <div className="routine-game">

            {/* =========================================
                GAME CONTAINER
            ========================================= */}

            <div className="game-container">


                {/* =====================================
                    CAMERA
                ===================================== */}

                <div className="camera-preview">

                    <video
                        ref={videoRef}
                        className="camera-video"
                        autoPlay
                        muted
                        playsInline
                    />


                    {!cameraReady && (

                        <div className="camera-loading">
                            카메라 준비 중...
                        </div>

                    )}

                </div>


                {/* =====================================
                    TIMER
                ===================================== */}

                <div className="live-time">

                    <span className="live-dot" />

                    지속 시간{" "}

                    {formatTime(
                        timeLeft
                    )}

                </div>


                {/* =====================================
                    REALTIME DATA
                ===================================== */}

                <div className="data-area">

                    <div className="data-card">

                        <div className="data-title">
                            실시간 데이터
                        </div>


                        <div className="data-row">

                            <div>

                                <span>
                                    잡은 공
                                </span>


                                <strong>
                                    {score}번
                                </strong>

                            </div>


                            <div>

                                <span>
                                    손 인식
                                </span>


                                <strong>
                                    {handCount}
                                </strong>

                            </div>

                        </div>

                    </div>


                    {/* =================================
                        DISTANCE
                    ================================= */}

                    <div className="distance-card">

                        <div className="distance-header">

                            <span>
                                화면 거리
                            </span>


                            <strong
                                className={
                                    screenDistance.status ===
                                    "적정"
                                        ? "distance-good"
                                        : "distance-warning"
                                }
                            >
                                {
                                    screenDistance.status
                                }
                            </strong>

                        </div>


                        <div className="distance-bar">

                            <div
                                className="distance-marker"
                                style={{
                                    left:
                                        `${screenDistance.value}%`,
                                }}
                            />

                        </div>


                        <div className="distance-label">

                            <span>
                                가까움
                            </span>

                            <span>
                                적정
                            </span>

                            <span>
                                멂
                            </span>

                        </div>

                    </div>

                </div>


                {/* =====================================
                    GAME AREA
                    여기 영역이 크게 확장됨
                ===================================== */}

                <div className="play-area">

                    <canvas
                        ref={canvasRef}
                    />

                </div>


                {/* =====================================
                    GUIDE
                ===================================== */}

                <div className="instruction">

                    주먹을 쥔 상태로 공에 가져가세요

                    <span>
                        {" "}· 손을 펴면 공을 놓습니다
                    </span>

                </div>


                {/* =====================================
                    PROGRESS
                ===================================== */}

                <div className="progress-section">

                    <div className="progress-bar">

                        <div
                            className="progress-fill"
                            style={{
                                width:
                                    `${progress}%`,
                            }}
                        />


                        <div
                            className="progress-dot"
                            style={{
                                left:
                                    `${progress}%`,
                            }}
                        />

                    </div>


                    <div className="steps">

                        <span>
                            STEP 1
                        </span>

                        <span>
                            STEP 2
                        </span>

                        <span>
                            STEP 3
                        </span>

                        <span>
                            STEP 4
                        </span>

                    </div>

                </div>

            </div>


            {/* =========================================
                CONTROL
                게임 화면 아래로 내려감
            ========================================= */}

            <div className="control-area">

                <button
                    className="stop-button"
                    onClick={() =>
                        setIsRunning(false)
                    }
                >
                    종료
                </button>


                <button
                    className="reset-button"
                    onClick={resetGame}
                >
                    초기화
                </button>

            </div>


            {/* =========================================
                STYLE
            ========================================= */}

            <style>{`

                * {
                    box-sizing: border-box;
                }


                /* ======================================
                   전체
                ====================================== */

                .routine-game {

                    width: 100%;

                    max-width: 1300px;

                    margin: 0 auto;

                    padding:
                        24px 30px 40px;

                    color: white;
                }


                /* ======================================
                   게임 화면
                ====================================== */

                .game-container {

                    position: relative;

                    width: 100%;

                    /*
                     * 기존 470px
                     * → 560px
                     *
                     * 게임 영역을 크게 사용
                     */
                    height: 560px;

                    overflow: hidden;

                    border-radius: 22px;

                    background: #252525;
                }


                /* ======================================
                   카메라
                ====================================== */

                .camera-preview {

                    position: absolute;

                    left: 20px;
                    top: 18px;

                    width: 225px;
                    height: 135px;

                    overflow: hidden;

                    border-radius: 22px;

                    background: #111;

                    z-index: 20;
                }


                .camera-video {

                    width: 100%;
                    height: 100%;

                    object-fit: cover;

                    transform:
                        scaleX(-1);
                }


                .camera-loading {

                    position: absolute;

                    inset: 0;

                    display: flex;

                    align-items: center;
                    justify-content: center;

                    background: #151515;

                    color: #aaa;

                    font-size: 11px;
                }


                /* ======================================
                   타이머
                ====================================== */

                .live-time {

                    position: absolute;

                    top: 20px;
                    left: 50%;

                    transform:
                        translateX(-50%);

                    display: flex;

                    align-items: center;

                    gap: 7px;

                    padding:
                        8px 15px;

                    border-radius: 20px;

                    background: #4b4b4b;

                    color: #eee;

                    font-size: 12px;

                    font-weight: 600;

                    z-index: 20;
                }


                .live-dot {

                    width: 8px;
                    height: 8px;

                    border-radius: 50%;

                    background: #e95353;
                }


                /* ======================================
                   데이터
                ====================================== */

                .data-area {

                    position: absolute;

                    top: 20px;
                    right: 20px;

                    width: 175px;

                    display: flex;

                    flex-direction: column;

                    gap: 10px;

                    z-index: 20;
                }


                .data-card,
                .distance-card {

                    padding:
                        14px 16px;

                    border-radius: 17px;

                    background: #484848;
                }


                .data-title {

                    margin-bottom: 12px;

                    color: #eee;

                    font-size: 12px;

                    font-weight: 700;
                }


                .data-row {

                    display: flex;

                    justify-content:
                        space-between;
                }


                .data-row div {

                    display: flex;

                    flex-direction: column;

                    gap: 3px;
                }


                .data-row span {

                    color: #aaa;

                    font-size: 8px;
                }


                .data-row strong {

                    color: white;

                    font-size: 17px;
                }


                /* ======================================
                   거리
                ====================================== */

                .distance-header {

                    display: flex;

                    align-items: center;

                    justify-content:
                        space-between;

                    margin-bottom: 12px;
                }


                .distance-header span {

                    color: #ddd;

                    font-size: 12px;
                }


                .distance-header strong {

                    font-size: 10px;
                }


                .distance-good {

                    color:
                        #c8e9a7 !important;
                }


                .distance-warning {

                    color:
                        #f1a3a3 !important;
                }


                .distance-bar {

                    position: relative;

                    width: 100%;
                    height: 12px;

                    border-radius: 20px;

                    background:
                        linear-gradient(
                            90deg,
                            #e89b9b 0%,
                            #b7e395 42%,
                            #b7e395 58%,
                            #e89b9b 100%
                        );
                }


                .distance-marker {

                    position: absolute;

                    top: -5px;

                    width: 3px;
                    height: 22px;

                    border-radius: 3px;

                    background: white;

                    box-shadow:
                        0 0 4px
                        rgba(
                            255,
                            255,
                            255,
                            0.7
                        );

                    transition:
                        left 0.18s
                        ease-out;
                }


                .distance-label {

                    display: flex;

                    justify-content:
                        space-between;

                    margin-top: 6px;

                    color: #999;

                    font-size: 6px;
                }


                /* ======================================
                   ★ 공 게임 영역
                   ====================================== */

                .play-area {

                    position: absolute;

                    left: 20px;
                    right: 20px;

                    /*
                     * 상단 UI 아래에서 시작
                     */
                    top: 150px;

                    /*
                     * 기존 35px보다 조금 여유를 둠
                     * 아래쪽까지 공이 움직일 수 있음
                     */
                    bottom: 48px;

                    overflow: hidden;
                }


                .play-area canvas {

                    display: block;

                    width: 100%;
                    height: 100%;
                }


                /* ======================================
                   안내 문구
                ====================================== */

                .instruction {

                    position: absolute;

                    left: 0;
                    right: 0;

                    /*
                     * 진행바 바로 위
                     */
                    bottom: 70px;

                    text-align: center;

                    color: #ddd;

                    font-size: 14px;

                    font-weight: 500;

                    z-index: 10;

                    pointer-events: none;
                }


                .instruction span {

                    color: #999;
                }


                /* ======================================
                   진행바
                ====================================== */

                .progress-section {

                    position: absolute;

                    left: 40px;
                    right: 40px;

                    bottom: 17px;
                }


                .progress-bar {

                    position: relative;

                    width: 100%;
                    height: 7px;

                    border-radius: 10px;

                    background: #d2d2d2;
                }


                .progress-fill {

                    position: absolute;

                    left: 0;
                    top: 0;

                    height: 100%;

                    border-radius: 10px;

                    background: #557bc5;

                    transition:
                        width 1s linear;
                }


                .progress-dot {

                    position: absolute;

                    top: 50%;

                    width: 7px;
                    height: 7px;

                    transform:
                        translate(
                            -50%,
                            -50%
                        );

                    border-radius: 50%;

                    background: white;
                }


                .steps {

                    display: flex;

                    justify-content:
                        space-between;

                    margin-top: 8px;

                    color: #888;

                    font-size: 7px;
                }


                /* ======================================
                   ★ 종료 / 초기화 영역
                ====================================== */

                .control-area {

                    display: flex;

                    align-items: center;

                    justify-content:
                        center;

                    gap: 20px;

                    /*
                     * 게임 화면과 버튼 사이
                     */
                    margin-top: 12px;

                    /*
                     * 버튼 영역을 크게
                     */
                    min-height: 90px;

                    padding: 24px;

                    background: #292929;
                }


                .control-area button {

                    width: 120px;
                    height: 42px;

                    border-radius: 22px;

                    background:
                        transparent;

                    color: white;

                    font-size: 13px;

                    font-weight: 600;

                    cursor: pointer;

                    transition:
                        background 0.2s;
                }


                .stop-button {

                    border:
                        1px solid #9b4c4c;

                    color:
                        #db6b6b !important;
                }


                .reset-button {

                    border:
                        1px solid #777;
                }


                .control-area button:hover {

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            0.08
                        );
                }


                /* ======================================
                   모바일
                ====================================== */

                @media (
                    max-width: 750px
                ) {

                    .routine-game {

                        padding:
                            15px 15px 30px;
                    }


                    .game-container {

                        /*
                         * 모바일에서도
                         * 기존보다 큰 게임 영역
                         */
                        height: 520px;
                    }


                    .camera-preview {

                        left: 14px;
                        top: 14px;

                        width: 180px;
                        height: 108px;
                    }


                    .data-area {

                        top: 12px;
                        right: 12px;

                        width: 145px;
                    }


                    .play-area {

                        left: 12px;
                        right: 12px;

                        top: 130px;

                        bottom: 45px;
                    }


                    .progress-section {

                        left: 20px;
                        right: 20px;

                        bottom: 14px;
                    }


                    .instruction {

                        bottom: 63px;

                        font-size: 12px;
                    }


                    .control-area {

                        min-height: 85px;

                        padding: 20px;
                    }


                    .control-area button {

                        width: 105px;
                        height: 40px;
                    }

                }

            `}</style>

        </div>
    );
}


export default RoutineGame;