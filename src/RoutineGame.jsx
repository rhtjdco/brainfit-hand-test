import React, { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    HandLandmarker,
    FaceLandmarker,
} from "@mediapipe/tasks-vision";


// ======================================================
// 시간
// ======================================================

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
};


// ======================================================
// 거리
// ======================================================

const getDistance = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);
};


const lerp = (current, target, amount) => {
    return current + (target - current) * amount;
};


// ======================================================
// 공 색상
// ======================================================

const BALL_TYPES = {
    purple: {
        name: "보라색",
        color: "#7C73A7",
    },

    blue: {
        name: "파란색",
        color: "#8EA9B8",
    },

    gray: {
        name: "회색",
        color: "#9A9A9A",
    },
};


// ======================================================
// 미션
// ======================================================

const MISSIONS = [

    {
        id: "COLOR_SORT",

        title: "같은 색깔 구역에 공 넣기",

        description:
            "공을 같은 색깔 영역으로 옮겨보세요",

        type: "COLOR_SORT",
    },

    {
        id: "SEQUENCE",

        title: "순서대로 공 잡기",

        description:
            "보라색 → 파란색 → 회색 순서로 잡아보세요",

        type: "SEQUENCE",
    },

    {
        id: "MOVING_TARGET",

        title: "움직이는 목표에 공 넣기",

        description:
            "움직이는 목표 영역 안에서 손을 펴보세요",

        type: "MOVING_TARGET",
    },

    {
        id: "SAME_COLOR",

        title: "같은 색 3개 모으기",

        description:
            "같은 색 공 3개를 목표 영역으로 모아보세요",

        type: "SAME_COLOR",
    },

    {
        id: "TIME_ATTACK",

        title: "20초 동안 공 3개 옮기기",

        description:
            "20초 안에 공 3개를 목표 영역으로 옮겨보세요",

        type: "TIME_ATTACK",
    },
];


// ======================================================
// 랜덤 미션
// ======================================================

const getRandomMission = (excludeType = null) => {

    const candidates = MISSIONS.filter(
        item => item.type !== excludeType
    );

    const pool = candidates.length ? candidates : MISSIONS;
    const index = Math.floor(Math.random() * pool.length);

    return pool[index];
};


// ======================================================
// 공 생성
// ======================================================

const createBall = (
    id,
    type,
    x,
    y
) => {

    return {

        id,

        type,

        x,

        y,

        radius: 42,

        grabbed: false,

        grabbedBy: null,

        grabOffsetX: 0,

        grabOffsetY: 0,

        releaseStartTime: null,
    };
};


// ======================================================
// 안전한 공 위치
// ======================================================

const getSafeBallPosition = (existing = []) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const candidate = {
            x: 0.10 + Math.random() * 0.80,
            y: 0.18 + Math.random() * 0.50,
        };

        if (existing.every(ball => getDistance(candidate, ball) > 0.18)) {
            return candidate;
        }
    }

    return { x: 0.50, y: 0.42 };
};


const createNormalBalls = () => {
    const balls = [];
    ["purple", "blue", "gray"].forEach((type, index) => {
        const position = getSafeBallPosition(balls);
        balls.push(createBall(`${type}-${index + 1}`, type, position.x, position.y));
    });
    return balls;
};


// ======================================================
// 같은 색 3개
// ======================================================

const createSameColorBalls = () => {
    const types = ["purple", "blue", "gray"];
    const targetType = types[Math.floor(Math.random() * types.length)];
    const balls = [];

    for (let i = 0; i < 3; i += 1) {
        const position = getSafeBallPosition(balls);
        balls.push(createBall(`${targetType}-target-${i + 1}`, targetType, position.x, position.y));
    }

    types.filter(type => type !== targetType).forEach((type, index) => {
        const position = getSafeBallPosition(balls);
        balls.push(createBall(`${type}-distractor-${index + 1}`, type, position.x, position.y));
    });

    return { balls, targetType };
};


// ======================================================
// 움직이는 목표 공 3개
// ======================================================

const createMovingTargetBalls = () => {
    const balls = [];
    ["purple", "blue", "gray"].forEach((type, index) => {
        const position = getSafeBallPosition(balls);
        balls.push(createBall(`moving-${type}-${index + 1}`, type, position.x, position.y));
    });
    return balls;
};


// ======================================================
// 20초 타임어택 공 3개
// ======================================================

const createTimeAttackBalls = () => {
    const balls = [];
    const types = ["purple", "blue", "gray"];

    for (let i = 0; i < 3; i += 1) {
        const type = types[Math.floor(Math.random() * types.length)];
        const position = getSafeBallPosition(balls);
        balls.push(createBall(`time-${i + 1}`, type, position.x, position.y));
    }

    return balls;
};


// ======================================================
// 컴포넌트
// ======================================================

function RoutineGame() {

    // ==================================================
    // DOM
    // ==================================================

    const videoRef =
        useRef(null);

    const canvasRef =
        useRef(null);


    // ==================================================
    // MediaPipe
    // ==================================================

    const handLandmarkerRef =
        useRef(null);

    const faceLandmarkerRef =
        useRef(null);

    const streamRef =
        useRef(null);


    // ==================================================
    // 게임
    // ==================================================

    const animationRef =
        useRef(null);

    const handsRef =
        useRef([]);

    const ballsRef =
        useRef([]);


    // ==================================================
    // 미션
    // ==================================================

    const missionRef =
        useRef(null);


    // ==================================================
    // 미션 진행
    // ==================================================

    const missionProgressRef =
        useRef(0);

    const sequenceIndexRef =
        useRef(0);

    const missionStartTimeRef =
        useRef(null);


    // ==================================================
    // 움직이는 목표
    // ==================================================

    const movingTargetRef =
        useRef({
            x: 0.5,
            y: 0.45,
            radius: 0.11,
            vx: 0.00042,
            vy: 0.00024,
        });

    const sameColorTargetTypeRef =
        useRef("purple");


    // ==================================================
    // 거리
    // ==================================================

    const distanceRef =
        useRef({

            value: 50,

            status: "적정",

        });


    const lastDistanceUpdateRef =
        useRef(0);


    const faceLostCountRef =
        useRef(0);


    // ==================================================
    // 설정
    // ==================================================

    const CONFIG = {

        positionSmooth: 0.32,

        fistEnterThreshold: 3.7,

        fistExitThreshold: 2.4,

        grabDistance: 0.10,

        ballFollowSmooth: 0.35,

        releaseDelay: 120,

        lostHandGraceTime: 350,

        distanceUpdateInterval: 100,

        faceLostMaxFrames: 15,
        timeAttackDuration: 20,

    };


    // ==================================================
    // State
    // ==================================================

    const [cameraReady, setCameraReady] =
        useState(false);

    const [isRunning, setIsRunning] =
        useState(true);

    const [elapsedTime, setElapsedTime] =
        useState(0);

    const [successCount, setSuccessCount] =
        useState(0);

    const [handCount, setHandCount] =
        useState(0);

    const [screenDistance, setScreenDistance] =
        useState({

            value: 50,

            status: "적정",

        });


    const [mission, setMission] =
        useState(() =>
            getRandomMission()
        );


    const [missionStatus, setMissionStatus] =
        useState("playing");


    const [missionProgress, setMissionProgress] =
        useState(0);


    const [sequenceIndex, setSequenceIndex] =
        useState(0);


    const [missionRemaining, setMissionRemaining] =
        useState(CONFIG.timeAttackDuration);


    // ==================================================
    // 미션 Ref 초기화
    // ==================================================

    const setupMission = (nextMission) => {

        missionRef.current = nextMission;
        missionProgressRef.current = 0;
        sequenceIndexRef.current = 0;
        missionStartTimeRef.current = performance.now();

        setMissionProgress(0);
        setSequenceIndex(0);
        setMissionRemaining(
            nextMission.type === "TIME_ATTACK"
                ? CONFIG.timeAttackDuration
                : 60
        );
        setMissionStatus("playing");
        setIsRunning(true);

        if (nextMission.type === "SAME_COLOR") {
            const sameColor = createSameColorBalls();
            sameColorTargetTypeRef.current = sameColor.targetType;
            ballsRef.current = sameColor.balls;
        } else if (nextMission.type === "MOVING_TARGET") {
            ballsRef.current = createMovingTargetBalls();
            movingTargetRef.current = {
                x: 0.22 + Math.random() * 0.56,
                y: 0.28 + Math.random() * 0.28,
                radius: 0.11,
                vx: (Math.random() > 0.5 ? 1 : -1) * 0.00042,
                vy: (Math.random() > 0.5 ? 1 : -1) * 0.00024,
            };
        } else if (nextMission.type === "TIME_ATTACK") {
            ballsRef.current = createTimeAttackBalls();
        } else {
            ballsRef.current = createNormalBalls();
        }
    };


    useEffect(() => {
        setupMission(mission);
    }, [mission]);


    // ==================================================
    // 손바닥
    // ==================================================

    const getPalmCenter =
        (landmarks) => {

            const points = [

                landmarks[0],

                landmarks[5],

                landmarks[9],

                landmarks[13],

                landmarks[17],

            ];


            let x = 0;

            let y = 0;


            points.forEach(
                point => {

                    x += point.x;

                    y += point.y;

                }
            );


            return {

                x:
                    x /
                    points.length,

                y:
                    y /
                    points.length,

            };
        };


    // ==================================================
    // 주먹 점수
    // ==================================================

    const getFistScore =
        (landmarks) => {

            const wrist =
                landmarks[0];


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
    // 주먹
    // ==================================================

    const updateFistState =
        (
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
    // 손 위치
    // ==================================================

    const getStableHandPosition =
        (
            landmarks,
            previousHand
        ) => {

            const palm =
                getPalmCenter(
                    landmarks
                );


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

                x:
                    lerp(
                        previousHand.x,
                        targetX,
                        CONFIG.positionSmooth
                    ),

                y:
                    lerp(
                        previousHand.y,
                        targetY,
                        CONFIG.positionSmooth
                    ),

            };
        };


    // ==================================================
    // 카메라
    // ==================================================

    const startCamera =
        async () => {

            try {

                const stream =
                    await navigator
                        .mediaDevices
                        .getUserMedia({

                            video: {

                                width: {
                                    ideal: 1280,
                                },

                                height: {
                                    ideal: 720,
                                },

                                facingMode:
                                    "user",

                            },

                            audio: false,

                        });


                streamRef.current =
                    stream;


                if (
                    !videoRef.current
                ) {

                    return;
                }


                videoRef.current
                    .srcObject =
                    stream;


                await new Promise(
                    resolve => {

                        videoRef.current
                            .onloadedmetadata =
                            resolve;

                    }
                );


                await videoRef.current
                    .play();


                setCameraReady(true);


            } catch (error) {

                console.error(
                    "카메라 시작 실패",
                    error
                );

            }
        };


    // ==================================================
    // MediaPipe
    // ==================================================

    const initializeMediaPipe =
        async () => {

            try {

                const vision =
                    await FilesetResolver
                        .forVisionTasks(

                            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"

                        );


                const handLandmarker =
                    await HandLandmarker
                        .createFromOptions(

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


                const faceLandmarker =
                    await FaceLandmarker
                        .createFromOptions(

                            vision,

                            {

                                baseOptions: {

                                    modelAssetPath:

                                        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

                                    delegate:
                                        "GPU",

                                },

                                runningMode:
                                    "VIDEO",

                                numFaces: 1,

                                minFaceDetectionConfidence:
                                    0.3,

                                minFacePresenceConfidence:
                                    0.3,

                                minTrackingConfidence:
                                    0.3,

                            }

                        );


                faceLandmarkerRef.current =
                    faceLandmarker;


            } catch (error) {

                console.error(
                    "MediaPipe 초기화 실패",
                    error
                );

            }
        };


    // ==================================================
    // 얼굴 거리
    // ==================================================

    const detectScreenDistance =
        (
            video,
            timestamp
        ) => {

            if (
                !faceLandmarkerRef.current ||
                !video ||
                video.readyState < 2
            ) {

                return;
            }


            try {

                const result =
                    faceLandmarkerRef.current
                        .detectForVideo(
                            video,
                            timestamp
                        );


                if (
                    !result.faceLandmarks ||
                    result.faceLandmarks.length === 0
                ) {

                    faceLostCountRef.current += 1;


                    if (
                        faceLostCountRef.current <
                        CONFIG.faceLostMaxFrames
                    ) {

                        return;
                    }


                    setScreenDistance({

                        value: 5,

                        status: "너무 멂",

                    });


                    return;
                }


                faceLostCountRef.current =
                    0;


                const landmarks =
                    result.faceLandmarks[0];


                const left =
                    landmarks[234];

                const right =
                    landmarks[454];


                if (
                    !left ||
                    !right
                ) {

                    return;
                }


                const faceWidth =
                    Math.abs(
                        right.x -
                        left.x
                    );


                let status;


                if (
                    faceWidth < 0.075
                ) {

                    status =
                        "너무 멂";

                } else if (
                    faceWidth < 0.17
                ) {

                    status =
                        "적정";

                } else {

                    status =
                        "너무 가까움";
                }


                let value;


                if (
                    faceWidth < 0.075
                ) {

                    value =
                        (
                            faceWidth /
                            0.075
                        ) *
                        35;

                } else if (
                    faceWidth < 0.17
                ) {

                    value =
                        35 +
                        (
                            (
                                faceWidth -
                                0.075
                            ) /
                            0.095
                        ) *
                        30;

                } else {

                    value =
                        65 +
                        Math.min(
                            35,

                            (
                                (
                                    faceWidth -
                                    0.17
                                ) /
                                0.12
                            ) *
                            35
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


                const smooth =
                    distanceRef.current
                        .value *
                        0.75 +
                    value *
                        0.25;


                distanceRef.current = {

                    value:
                        smooth,

                    status,

                };


                if (
                    timestamp -
                    lastDistanceUpdateRef.current >
                    CONFIG.distanceUpdateInterval
                ) {

                    lastDistanceUpdateRef.current =
                        timestamp;


                    setScreenDistance({

                        value:
                            smooth,

                        status,

                    });
                }

            } catch (error) {

                console.error(
                    "거리 측정 오류",
                    error
                );
            }
        };


    // ==================================================
    // 손 인식
    // ==================================================

    const detectHands =
        (timestamp) => {

            if (
                !videoRef.current ||
                !handLandmarkerRef.current ||
                videoRef.current.readyState < 2
            ) {

                return;
            }


            detectScreenDistance(
                videoRef.current,
                timestamp
            );


            try {

                const result =
                    handLandmarkerRef.current
                        .detectForVideo(

                            videoRef.current,

                            timestamp

                        );


                const previousHands =
                    handsRef.current;


                const detectedHands = [];


                if (
                    result.landmarks
                ) {

                    result.landmarks
                        .forEach(
                            (
                                landmarks
                            ) => {

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


                                previousHands
                                    .forEach(
                                        hand => {

                                            const distance =
                                                getDistance(
                                                    hand,
                                                    {
                                                        x: rawX,
                                                        y: rawY,
                                                    }
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
                                    closest >
                                    0.4
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

                                // 공을 잡는 동작은 "주먹을 쥐고 있는 상태"가 아니라
                                // "펴진 손 -> 주먹으로 접히는 순간"에만 허용한다.
                                // 따라서 주먹을 쥔 채 공 쪽으로 이동해도 공이 자동으로 붙지 않는다.
                                const fistJustClosed =
                                    fist &&
                                    !(previousHand?.fist ?? false);


                                detectedHands
                                    .push({

                                        id:
                                            previousHand?.id ??
                                            `hand-${Math.random()}`,

                                        x:
                                            position.x,

                                        y:
                                            position.y,

                                        fist,

                                        fistJustClosed,

                                        fistScore,

                                        landmarks,

                                        lastSeen:
                                            timestamp,

                                    });

                            }
                        );
                }


                previousHands.forEach(
                    previous => {

                        const exists =
                            detectedHands
                                .some(
                                    hand =>
                                        hand.id ===
                                        previous.id
                                );


                        if (
                            !exists &&
                            timestamp -
                            previous.lastSeen <
                            CONFIG.lostHandGraceTime
                        ) {

                            detectedHands
                                .push({
                                    ...previous,
                                });
                        }

                    }
                );


                handsRef.current =
                    detectedHands;


                setHandCount(
                    result.landmarks?.length || 0
                );

            } catch (error) {

                console.error(
                    "손 인식 오류",
                    error
                );
            }
        };


    // ==================================================
    // 목표 영역
    // ==================================================

    const getTargetZone =
        (ball) => {

            const missionType =
                mission.type;


            if (
                missionType ===
                "COLOR_SORT"
            ) {

                if (
                    ball.type ===
                    "purple"
                ) {

                    return {
                        x: 0.25,
                        y: 0.78,
                        radius: 0.11,
                        color:
                            "#7C73A7",
                    };

                }


                if (
                    ball.type ===
                    "blue"
                ) {

                    return {
                        x: 0.50,
                        y: 0.78,
                        radius: 0.11,
                        color:
                            "#8EA9B8",
                    };

                }


                return {

                    x: 0.75,

                    y: 0.78,

                    radius: 0.11,

                    color:
                        "#9A9A9A",

                };
            }


            if (
                missionType ===
                "MOVING_TARGET"
            ) {

                return {
                    ...movingTargetRef.current,
                };
            }


            if (
                missionType ===
                "SAME_COLOR"
            ) {

                return {

                    x: 0.50,

                    y: 0.78,

                    radius: 0.13,

                    color:
                        BALL_TYPES[
                            sameColorTargetTypeRef.current
                        ].color,

                };
            }


            if (
                missionType ===
                "TIME_ATTACK"
            ) {

                return {

                    x: 0.50,

                    y: 0.76,

                    radius: 0.12,

                    color:
                        "#8EA9B8",

                };
            }


            return {

                x: 0.5,

                y: 0.78,

                radius: 0.12,

                color:
                    "#777",

            };
        };


    // ==================================================
    // 목표 영역 안인지
    // ==================================================

    const isInsideTarget =
        (
            ball,
            target
        ) => {

            return (
                getDistance(
                    ball,
                    target
                ) <
                target.radius
            );
        };


    // ==================================================
    // 다음 미션
    // ==================================================

    const goToNextMission = (countSuccess = false) => {
        if (countSuccess) {
            setSuccessCount(previous => previous + 1);
        }

        setMission(getRandomMission(mission.type));
    };


    const completeMission = () => {
        goToNextMission(true);
    };


    const failMission = () => {
        goToNextMission(false);
    };


    // 공 놓기 판정
    // ==================================================

    const handleBallRelease =
        (
            ball,
            target
        ) => {

            // ------------------------------------------
            // 같은 색깔 구역에 공 넣기
            // 3개의 공을 모두 올바른 색 구역에 넣어야 성공
            // ------------------------------------------

            if (
                mission.type ===
                "COLOR_SORT"
            ) {

                if (
                    isInsideTarget(
                        ball,
                        target
                    )
                ) {

                    missionProgressRef.current += 1;

                    setMissionProgress(
                        missionProgressRef.current
                    );

                    ball.x = -1;
                    ball.y = -1;

                    if (
                        missionProgressRef.current >= 3
                    ) {
                        completeMission();
                    }
                }

                return;
            }


            // ------------------------------------------
            // 순서대로 공 잡았다 놓기
            // 목표 영역은 필요 없다.
            // ------------------------------------------

            if (
                mission.type ===
                "SEQUENCE"
            ) {

                const sequence = [
                    "purple",
                    "blue",
                    "gray",
                ];

                const expected =
                    sequence[
                        sequenceIndexRef.current
                    ];

                if (
                    ball.type !==
                    expected
                ) {
                    failMission();
                    return;
                }

                sequenceIndexRef.current += 1;

                setSequenceIndex(
                    sequenceIndexRef.current
                );

                ball.x = -1;
                ball.y = -1;

                if (
                    sequenceIndexRef.current >=
                    sequence.length
                ) {
                    completeMission();
                }

                return;
            }


            // ------------------------------------------
            // 움직이는 목표
            // 공 3개를 모두 목표 안에 넣어야 성공
            // ------------------------------------------

            if (
                mission.type ===
                "MOVING_TARGET"
            ) {

                if (
                    isInsideTarget(
                        ball,
                        target
                    )
                ) {

                    missionProgressRef.current += 1;

                    setMissionProgress(
                        missionProgressRef.current
                    );

                    ball.x = -1;
                    ball.y = -1;

                    if (
                        missionProgressRef.current >= 3
                    ) {
                        completeMission();
                    }
                }

                return;
            }


            // ------------------------------------------
            // 같은 색 3개 모으기
            // ------------------------------------------

            if (
                mission.type ===
                "SAME_COLOR"
            ) {

                if (
                    ball.type !==
                    sameColorTargetTypeRef.current
                ) {
                    return;
                }

                if (
                    isInsideTarget(
                        ball,
                        target
                    )
                ) {

                    missionProgressRef.current += 1;

                    setMissionProgress(
                        missionProgressRef.current
                    );

                    ball.x = -1;
                    ball.y = -1;

                    if (
                        missionProgressRef.current >= 3
                    ) {
                        completeMission();
                    }
                }

                return;
            }


            // ------------------------------------------
            // 20초 동안 공 3개 옮기기
            // ------------------------------------------

            if (
                mission.type ===
                "TIME_ATTACK"
            ) {

                if (
                    isInsideTarget(
                        ball,
                        target
                    )
                ) {

                    missionProgressRef.current += 1;

                    setMissionProgress(
                        missionProgressRef.current
                    );

                    ball.x = -1;
                    ball.y = -1;

                    if (
                        missionProgressRef.current >= 3
                    ) {
                        completeMission();
                    }
                }
            }
        };


    // ==================================================
    // 공 업데이트
    // ==================================================

    const updateBalls =
        (now) => {

            const balls =
                ballsRef.current;


            const hands =
                handsRef.current;


            // ------------------------------------------
            // 움직이는 목표
            // ------------------------------------------

            if (
                mission.type ===
                "MOVING_TARGET"
            ) {

                const target =
                    movingTargetRef.current;

                target.x += target.vx;
                target.y += target.vy;

                if (target.x > 0.78 || target.x < 0.22) {
                    target.vx *= -1;
                    target.x = Math.max(0.22, Math.min(0.78, target.x));
                }

                if (target.y > 0.58 || target.y < 0.25) {
                    target.vy *= -1;
                    target.y = Math.max(0.25, Math.min(0.58, target.y));
                }
            }


            // ------------------------------------------
            // 타임어택 시간
            // ------------------------------------------

            if (
                mission.type ===
                "TIME_ATTACK" &&
                missionStartTimeRef.current
            ) {

                const elapsed =
                    Math.floor(
                        (
                            now -
                            missionStartTimeRef.current
                        ) /
                        1000
                    );


                const remaining =
                    Math.max(
                        0,
                        CONFIG.timeAttackDuration - elapsed
                    );


                setMissionRemaining(
                    remaining
                );


                if (
                    remaining <= 0
                ) {

                    failMission();

                    return;
                }
            }


            // ------------------------------------------
            // 잡힌 공
            // ------------------------------------------

            balls.forEach(
                ball => {

                    if (
                        !ball.grabbed
                    ) {

                        return;
                    }


                    let hand =
                        hands.find(
                            candidate =>
                                candidate.id ===
                                ball.grabbedBy
                        );


                    // 잡고 있던 손이 사라지면 다른 손으로 자동 승계하지 않는다.
                    // 이 승계 로직이 두 손이 공을 뺏거나 한 손으로 여러 공을 잡는
                    // 원인이 될 수 있으므로 제거한다.

                    // 손 완전 소실
                    if (!hand) {

                        ball.grabbed =
                            false;

                        ball.grabbedBy =
                            null;

                        ball.releaseStartTime =
                            null;

                        return;
                    }


                    // ----------------------------------
                    // 주먹 유지
                    // ----------------------------------

                    if (
                        hand.fist
                    ) {

                        ball.releaseStartTime =
                            null;


                        const targetX =
                            hand.x +
                            ball.grabOffsetX;


                        const targetY =
                            hand.y +
                            ball.grabOffsetY;


                        ball.x =
                            lerp(
                                ball.x,
                                targetX,
                                CONFIG.ballFollowSmooth
                            );


                        ball.y =
                            lerp(
                                ball.y,
                                targetY,
                                CONFIG.ballFollowSmooth
                            );


                        ball.x =
                            Math.max(
                                0.05,
                                Math.min(
                                    0.95,
                                    ball.x
                                )
                            );


                        ball.y =
                            Math.max(
                                0.05,
                                Math.min(
                                    0.95,
                                    ball.y
                                )
                            );


                        return;
                    }


                    // ----------------------------------
                    // 손을 펴면 놓기
                    // ----------------------------------

                    if (
                        ball.releaseStartTime ===
                        null
                    ) {

                        ball.releaseStartTime =
                            now;

                        return;
                    }


                    if (
                        now -
                        ball.releaseStartTime >=
                        CONFIG.releaseDelay
                    ) {

                        const target =
                            getTargetZone(
                                ball
                            );


                        ball.grabbed =
                            false;

                        ball.grabbedBy =
                            null;

                        ball.releaseStartTime =
                            null;


                        handleBallRelease(
                            ball,
                            target
                        );
                    }

                }
            );


            // ------------------------------------------
            // 아직 안 잡힌 공
            // ------------------------------------------
            // 한 손은 한 공만 잡을 수 있고,
            // 반드시 "펴진 손 -> 주먹" 전환 순간에만 잡는다.
            // 주먹을 쥔 채 이동하면 절대로 새 공을 잡지 않는다.

            const occupiedHandIds = new Set(
                balls
                    .filter(ball => ball.grabbed && ball.grabbedBy)
                    .map(ball => ball.grabbedBy)
            );

            const availableHands = hands
                .filter(hand => hand.fistJustClosed)
                .filter(hand => !occupiedHandIds.has(hand.id));

            availableHands.forEach(hand => {

                let nearestBall = null;
                let nearestDistance = Infinity;

                balls.forEach(ball => {

                    if (
                        ball.grabbed ||
                        ball.x < 0
                    ) {
                        return;
                    }

                    const distance =
                        getDistance(
                            hand,
                            ball
                        );

                    if (
                        distance < nearestDistance
                    ) {
                        nearestDistance = distance;
                        nearestBall = ball;
                    }
                });

                // 주먹을 접은 바로 그 순간 공 위에 있어야 한다.
                if (
                    nearestBall &&
                    nearestDistance < CONFIG.grabDistance
                ) {

                    // 순서 미션은 틀린 공을 잡는 순간 실패
                    if (
                        mission.type ===
                        "SEQUENCE"
                    ) {

                        const sequence = [
                            "purple",
                            "blue",
                            "gray",
                        ];

                        const expected =
                            sequence[
                                sequenceIndexRef.current
                            ];

                        if (
                            nearestBall.type !==
                            expected
                        ) {
                            failMission();
                            return;
                        }
                    }

                    nearestBall.grabbed = true;
                    nearestBall.grabbedBy = hand.id;
                    nearestBall.grabOffsetX =
                        nearestBall.x - hand.x;
                    nearestBall.grabOffsetY =
                        nearestBall.y - hand.y;

                    occupiedHandIds.add(hand.id);
                }
            });
        };



    // ==================================================

    const drawBall =
        (
            ctx,
            ball,
            width,
            height
        ) => {

            if (
                ball.x < 0 ||
                ball.y < 0
            ) {

                return;
            }


            const x =
                ball.x *
                width;


            const y =
                ball.y *
                height;


            const radius =
                ball.radius;


            const type =
                BALL_TYPES[
                    ball.type
                ];


            ctx.save();


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

                    x -
                        radius *
                        0.35,

                    y -
                        radius *
                        0.35,

                    radius *
                        0.08,

                    x,

                    y,

                    radius

                );


            gradient.addColorStop(
                0,
                "#FFFFFF"
            );


            gradient.addColorStop(
                0.18,
                type.color
            );


            gradient.addColorStop(
                0.75,
                type.color
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
                x -
                    radius *
                    0.28,

                y -
                    radius *
                    0.30,

                radius *
                    0.055,

                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                "rgba(255,255,255,0.85)";


            ctx.fill();


            // 잡힌 공

            if (
                ball.grabbed
            ) {

                ctx.beginPath();


                ctx.arc(
                    x,
                    y,
                    radius + 8,
                    0,
                    Math.PI * 2
                );


                ctx.strokeStyle =
                    "rgba(255,255,255,0.85)";


                ctx.lineWidth = 2;


                ctx.stroke();
            }
        };


    // ==================================================
    // 목표 영역 그리기
    // ==================================================

    const drawTarget =
        (
            ctx,
            target,
            width,
            height,
            label
        ) => {

            const x =
                target.x *
                width;


            const y =
                target.y *
                height;


            const radius =
                target.radius *
                Math.min(
                    width,
                    height
                );


            ctx.save();


            ctx.beginPath();


            ctx.arc(
                x,
                y,
                radius,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                `${target.color}55`;


            ctx.fill();


            ctx.strokeStyle =
                target.color;


            ctx.lineWidth = 3;


            ctx.setLineDash([
                7,
                6
            ]);


            ctx.stroke();


            ctx.setLineDash([]);


            if (
                label
            ) {

                ctx.fillStyle =
                    "rgba(255,255,255,0.8)";


                ctx.font =
                    "12px Arial";


                ctx.textAlign =
                    "center";


                ctx.textBaseline =
                    "middle";


                ctx.fillText(
                    label,
                    x,
                    y
                );
            }


            ctx.restore();
        };


    // ==================================================
    // 손 포인터
    // ==================================================

    const drawHands =
        (
            ctx,
            width,
            height
        ) => {

            handsRef.current
                .forEach(
                    hand => {

                        const x =
                            hand.x *
                            width;


                        const y =
                            hand.y *
                            height;


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
                                ? "rgba(233,155,155,0.18)"
                                : "rgba(255,255,255,0.08)";


                        ctx.fill();


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
                                ? "#E99B9B"
                                : "rgba(255,255,255,0.8)";


                        ctx.lineWidth = 1.5;


                        ctx.stroke();


                        // 공과 가까우면 연결선

                        let nearestBall =
                            null;


                        let nearestDistance =
                            Infinity;


                        ballsRef.current
                            .forEach(
                                ball => {

                                    if (
                                        ball.x <
                                        0
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

                                        nearestBall =
                                            ball;
                                    }

                                }
                            );


                        if (
                            nearestBall &&
                            nearestDistance <
                            0.13
                        ) {

                            const ballX =
                                nearestBall.x *
                                width;


                            const ballY =
                                nearestBall.y *
                                height;


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
                                "rgba(255,255,255,0.3)";


                            ctx.lineWidth = 1;


                            ctx.setLineDash([
                                4,
                                5
                            ]);


                            ctx.stroke();


                            ctx.setLineDash([]);

                        }

                    }
                );
        };


    // ==================================================
    // 캔버스
    // ==================================================

    const renderGame =
        () => {

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


            const dpr =
                window.devicePixelRatio ||
                1;


            if (
                canvas.width !==
                width * dpr ||
                canvas.height !==
                height * dpr
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
                canvas.getContext(
                    "2d"
                );


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


            // =========================================
            // 목표
            // =========================================

            if (
                mission.type ===
                "COLOR_SORT"
            ) {

                drawTarget(
                    ctx,
                    {
                        x: 0.25,
                        y: 0.78,
                        radius: 0.09,
                        color:
                            "#7C73A7",
                    },
                    width,
                    height,
                    "보라"
                );


                drawTarget(
                    ctx,
                    {
                        x: 0.50,
                        y: 0.78,
                        radius: 0.09,
                        color:
                            "#8EA9B8",
                    },
                    width,
                    height,
                    "파랑"
                );


                drawTarget(
                    ctx,
                    {
                        x: 0.75,
                        y: 0.78,
                        radius: 0.09,
                        color:
                            "#9A9A9A",
                    },
                    width,
                    height,
                    "회색"
                );

            }


            if (
                mission.type ===
                "MOVING_TARGET"
            ) {

                drawTarget(
                    ctx,
                    movingTargetRef.current,
                    width,
                    height,
                    "TARGET"
                );

            }


            if (
                mission.type ===
                "SAME_COLOR"
            ) {

                drawTarget(
                    ctx,
                    {
                        x: 0.5,
                        y: 0.78,
                        radius: 0.13,
                        color:
                            BALL_TYPES[
                                sameColorTargetTypeRef.current
                            ].color,
                    },
                    width,
                    height,
                    "모으기"
                );

            }


            if (
                mission.type ===
                "TIME_ATTACK"
            ) {

                drawTarget(
                    ctx,
                    {
                        x: 0.5,
                        y: 0.76,
                        radius: 0.12,
                        color:
                            "#8EA9B8",
                    },
                    width,
                    height,
                    "GOAL"
                );

            }


            // =========================================
            // 공
            // =========================================

            ballsRef.current
                .forEach(
                    ball => {

                        drawBall(
                            ctx,
                            ball,
                            width,
                            height
                        );

                    }
                );


            // =========================================
            // 손
            // =========================================

            drawHands(
                ctx,
                width,
                height
            );
        };


    // ==================================================
    // 게임 루프
    // ==================================================

    const gameLoop =
        (timestamp) => {

            if (isRunning) {

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

    useEffect(
        () => {

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

                mounted = false;


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
                            track =>
                                track.stop()
                        );

                }

            };

        },
        []
    );


    // ==================================================
    // 게임 시작
    // ==================================================

    useEffect(
        () => {

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

        },
        [
            cameraReady,
            isRunning,
            mission,
        ]
    );


    // ==================================================
    // 전체 시간
    // ==================================================

    useEffect(
        () => {

            if (!isRunning) {

                return;
            }


            const timer =
                setInterval(
                    () => {

                        setElapsedTime(
                            previous =>
                                previous + 1
                        );

                    },
                    1000
                );


            return () =>
                clearInterval(
                    timer
                );

        },
        [
            isRunning,
            missionStatus,
        ]
    );


    // ==================================================
    // 초기화
    // ==================================================

    const resetGame = () => {
        setSuccessCount(0);
        setElapsedTime(0);
        setMission(getRandomMission(mission.type));
    };


    // ==================================================
    // 미션 표시
    // ==================================================

    const getMissionSubText =
        () => {

            if (
                mission.type ===
                "COLOR_SORT"
            ) {

                return "공 3개를 각각 같은 색 영역에 넣어보세요";

            }


            if (
                mission.type ===
                "SEQUENCE"
            ) {

                return "순서: 보라색 → 파란색 → 회색";

            }


            if (
                mission.type ===
                "MOVING_TARGET"
            ) {

                return "공 3개를 움직이는 목표에 모두 넣어보세요";

            }


            if (
                mission.type ===
                "SAME_COLOR"
            ) {

                return `${BALL_TYPES[sameColorTargetTypeRef.current].name} 공 3개를 모두 모아보세요`;

            }


            if (
                mission.type ===
                "TIME_ATTACK"
            ) {

                return "20초 안에 공 3개를 목표 영역으로 옮겨보세요";

            }


            return "";
        };


    // ==================================================
    // 미션 진행 표시
    // ==================================================

    const getProgressText =
        () => {

            if (
                mission.type ===
                "COLOR_SORT"
            ) {
                return `${missionProgress} / 3`;
            }


            if (
                mission.type ===
                "SEQUENCE"
            ) {

                return `${sequenceIndex} / 3`;

            }


            if (
                mission.type ===
                "SAME_COLOR"
            ) {

                return `${missionProgress} / 3`;

            }


            if (
                mission.type ===
                "TIME_ATTACK"
            ) {

                return `${missionProgress} / 3`;

            }


            return "";
        };


    // ==================================================
    // JSX
    // ==================================================

    return (

        <div className="routine-game">


            {/* =========================================
                게임
            ========================================= */}

            <div className="game-container">


                {/* =====================================
                    카메라
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
                    지속 시간
                ===================================== */}

                <div className="live-time">

                    <span className="live-dot" />

                    지속 시간{" "}

                    {formatTime(
                        elapsedTime
                    )}

                </div>


                {/* =====================================
                    실시간 데이터
                ===================================== */}

                <div className="data-area">


                    <div className="data-card">

                        <div className="data-title">
                            실시간 데이터
                        </div>


                        <div className="data-row">

                            <div>

                                <span>
                                    성공한 미션
                                </span>

                                <strong>
                                    {successCount}
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


                    {/* 거리 */}

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
                    게임 영역
                ===================================== */}

                <div className="play-area">

                    <canvas
                        ref={canvasRef}
                    />

                </div>


                {/* =====================================
                    하단 자막
                ===================================== */}

                <div className="instruction">

                    <span className="mission-text">

                        {mission.title}

                    </span>


                    <span className="instruction-sub">

                        {" "}·{" "}

                        {getMissionSubText()}

                    </span>

                </div>


                {/* =====================================
                    진행바
                ===================================== */}

                <div className="progress-section">

                    <div className="progress-bar">

                        <div
                            className="progress-fill"
                            style={{
                                width:
                                    `${
                                        mission.type ===
                                        "COLOR_SORT"

                                            ? (
                                                missionProgress /
                                                3
                                            ) * 100

                                            : mission.type ===
                                        "SEQUENCE"

                                            ? (
                                                sequenceIndex /
                                                3
                                            ) * 100

                                            : mission.type ===
                                              "SAME_COLOR"

                                                ? (
                                                    missionProgress /
                                                    3
                                                ) * 100

                                                : mission.type ===
                                                  "TIME_ATTACK"

                                                    ? (
                                                        missionProgress /
                                                        3
                                                    ) * 100

                                                    : 20
                                    }%`,
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
                컨트롤
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
                    onClick={
                        resetGame
                    }
                >
                    다른 미션
                </button>

            </div>


            {/* =========================================
                STYLE
            ========================================= */}

            <style>{`

                * {
                    box-sizing: border-box;
                }


                body {
                    margin: 0;
                    background: #17181d;
                }


                .routine-game {

                    width: 100vw;

                    min-height: 100vh;

                    margin-left:
                        calc(50% - 50vw);

                    background:
                        #17181d;

                    color: white;
                }


                /* ======================================
                   게임
                ====================================== */

                .game-container {

                    position: relative;

                    width: 100%;

                    height:
                        calc(100vh - 100px);

                    min-height: 650px;

                    overflow: hidden;

                    background:
                        #252525;
                }


                /* ======================================
                   카메라
                ====================================== */

                .camera-preview {

                    position: absolute;

                    left: 55px;

                    top: 28px;

                    width: 320px;

                    height: 192px;

                    overflow: hidden;

                    border-radius: 22px;

                    background: #111;

                    z-index: 100;
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
                   시간
                ====================================== */

                .live-time {

                    position: absolute;

                    top: 30px;

                    left: 50%;

                    transform:
                        translateX(-50%);

                    display: flex;

                    align-items: center;

                    gap: 7px;

                    padding:
                        8px 15px;

                    border-radius: 20px;

                    background:
                        #4b4b4b;

                    color: #eee;

                    font-size: 12px;

                    font-weight: 600;

                    z-index: 20;
                }


                .live-dot {

                    width: 8px;

                    height: 8px;

                    border-radius: 50%;

                    background:
                        #e95353;
                }


                /* ======================================
                   데이터
                ====================================== */

                .data-area {

                    position: absolute;

                    top: 28px;

                    right: 55px;

                    width: 225px;

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

                    background:
                        #484848;
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

                    font-size: 17px;
                }


                /* ======================================
                   거리
                ====================================== */

                .distance-header {

                    display: flex;

                    justify-content:
                        space-between;

                    margin-bottom: 12px;
                }


                .distance-header span {

                    font-size: 12px;

                    color: #ddd;
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

                    height: 10px;

                    border-radius: 20px;

                    background:
                        linear-gradient(
                            90deg,
                            #e89b9b,
                            #b7e395 50%,
                            #e89b9b
                        );
                }


                .distance-marker {

                    position: absolute;

                    top: -5px;

                    width: 3px;

                    height: 20px;

                    border-radius: 3px;

                    background: white;

                    transition:
                        left .18s ease-out;
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
                   플레이 영역
                ====================================== */

                .play-area {

                    position: absolute;

                    left: 40px;

                    right: 40px;

                    top: 165px;

                    bottom: 92px;

                    overflow: hidden;
                }


                .play-area canvas {

                    width: 100%;

                    height: 100%;

                    display: block;
                }


                /* ======================================
                   하단 설명
                ====================================== */

                .instruction {

                    position: absolute;

                    left: 0;

                    right: 0;

                    bottom: 73px;

                    display: flex;

                    justify-content:
                        center;

                    align-items: center;

                    text-align: center;

                    pointer-events: none;

                    white-space: nowrap;

                    z-index: 15;

                    font-size: 15px;
                }


                .mission-text {

                    color: #eee;

                    font-weight: 600;
                }


                .instruction-sub {

                    color: #888;

                    font-weight: 400;
                }


                /* ======================================
                   진행바
                ====================================== */

                .progress-section {

                    position: absolute;

                    left: 7%;

                    right: 7%;

                    bottom: 17px;
                }


                .progress-bar {

                    width: 100%;

                    height: 7px;

                    border-radius: 10px;

                    background:
                        #d2d2d2;

                    overflow: hidden;
                }


                .progress-fill {

                    height: 100%;

                    border-radius: 10px;

                    background:
                        #557bc5;

                    transition:
                        width .3s ease;
                }


                .steps {

                    display: flex;

                    justify-content:
                        space-between;

                    margin-top: 8px;

                    color: #888;

                    font-size: 8px;
                }


                /* ======================================
                   버튼
                ====================================== */

                .control-area {

                    min-height: 100px;

                    display: flex;

                    align-items: center;

                    justify-content:
                        center;

                    gap: 20px;

                    background:
                        #292929;
                }


                .control-area button {

                    width: 130px;

                    height: 44px;

                    border-radius: 24px;

                    background:
                        transparent;

                    color: white;

                    font-size: 13px;

                    font-weight: 600;

                    cursor: pointer;
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
                            .08
                        );
                }


                /* ======================================
                   모바일
                ====================================== */

                @media (
                    max-width: 750px
                ) {

                    .camera-preview {

                        left: 20px;

                        top: 20px;

                        width: 230px;

                        height: 138px;
                    }


                    .data-area {

                        top: 20px;

                        right: 20px;

                        width: 155px;
                    }


                    .play-area {

                        left: 15px;

                        right: 15px;

                        top: 140px;

                        bottom: 100px;
                    }


                    .instruction {

                        bottom: 72px;

                        padding:
                            0 15px;

                        white-space:
                            normal;

                        line-height: 1.5;

                        font-size: 12px;
                    }

                }

            `}</style>

        </div>
    );
}


export default RoutineGame;