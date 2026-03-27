import React, { useState, useRef, useEffect } from 'react';
import * as ort from 'onnxruntime-web';

export default function CameraDetection({ isOpen, onClose }) {
    const [isLoading, setIsLoading] = useState(false);
    const [detections, setDetections] = useState([]);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [stream, setStream] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const sessionRef = useRef(null);
    const animationFrameRef = useRef(null);

    // ONNX Model configuration
    const MODEL_INPUT_SIZE = 640; // YOLOv8 default input size
    const CONFIDENCE_THRESHOLD = 0.5;
    const IOU_THRESHOLD = 0.45;

    // Waste categories matching the model
    const CLASSES = ['bin', 'garbage', 'spills'];

    // Track detected sites to prevent duplicates
    const detectedSitesRef = useRef(new Set());
    const [taskStats, setTaskStats] = useState({ created: 0, pending: 0 });
    const [detectedSnapshots, setDetectedSnapshots] = useState([]);

    // Load ONNX model
    useEffect(() => {
        if (isOpen && !modelLoaded) {
            loadModel();
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isOpen]);

    const loadModel = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Configure ONNX Runtime
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';

            // Load the real model from public folder
            const modelPath = '/waste_detection.onnx';

            try {
                console.log('Loading ONNX model from:', modelPath);
                const session = await ort.InferenceSession.create(modelPath);
                sessionRef.current = session;
                setModelLoaded(true);
                console.log('✅ Model loaded successfully!');
                console.log('Model inputs:', session.inputNames);
                console.log('Model outputs:', session.outputNames);
            } catch (modelError) {
                console.warn('⚠️ Model file not found or failed to load. Running in demo mode.');
                console.error('Model error:', modelError);
                setError('Model not found. Running in demo mode with simulated detections.');
                setModelLoaded(true); // Set to true for demo mode
            }

            setIsLoading(false);
        } catch (err) {
            console.error('Error loading model:', err);
            setError('Failed to load detection model. Running in demo mode.');
            setIsLoading(false);
            setModelLoaded(true); // Continue in demo mode
        }
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                    detectObjects();
                };
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Failed to access camera. Please ensure camera permissions are granted.');
        }
    };

    const preprocessImage = (imageData) => {
        const { data, width, height } = imageData;
        const input = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);

        // Resize and normalize image
        for (let y = 0; y < MODEL_INPUT_SIZE; y++) {
            for (let x = 0; x < MODEL_INPUT_SIZE; x++) {
                const srcX = Math.floor(x * width / MODEL_INPUT_SIZE);
                const srcY = Math.floor(y * height / MODEL_INPUT_SIZE);
                const srcIdx = (srcY * width + srcX) * 4;

                // Normalize to [0, 1] and arrange in CHW format
                input[y * MODEL_INPUT_SIZE + x] = data[srcIdx] / 255.0; // R
                input[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE + y * MODEL_INPUT_SIZE + x] = data[srcIdx + 1] / 255.0; // G
                input[2 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE + y * MODEL_INPUT_SIZE + x] = data[srcIdx + 2] / 255.0; // B
            }
        }

        return input;
    };

    const detectObjects = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current; // hidden offscreen canvas for inference only
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw frame for inference — this canvas is hidden, not shown to user
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (sessionRef.current) {
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const inputTensor = preprocessImage(imageData);
                const tensor = new ort.Tensor('float32', inputTensor, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
                const feeds = { images: tensor };
                const results = await sessionRef.current.run(feeds);

                const output = results[Object.keys(results)[0]];
                const detectedObjects = processDetections(output, canvas.width, canvas.height);

                if (detectedObjects.length > 0) {
                    for (const detection of detectedObjects) {
                        await verifyAndCreateTask(detection, canvas);
                    }
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        } else {
            // Demo mode
            const demoDetections = generateDemoDetections();
            if (demoDetections.length > 0) {
                for (const detection of demoDetections) {
                    await verifyAndCreateTask(detection, canvas);
                }
            }
        }

        animationFrameRef.current = requestAnimationFrame(detectObjects);
    };

    const generateDemoDetections = () => {
        // Generate random demo detections for demonstration
        if (Math.random() > 0.7) {
            return [{
                class: CLASSES[Math.floor(Math.random() * CLASSES.length)],
                confidence: 0.85 + Math.random() * 0.15,
                bbox: {
                    x: Math.random() * 0.5,
                    y: Math.random() * 0.5,
                    width: 0.2 + Math.random() * 0.2,
                    height: 0.2 + Math.random() * 0.2
                }
            }];
        }
        return [];
    };

    const processDetections = (output, canvasWidth, canvasHeight) => {
        if (!output || !output.data) {
            console.log('No output data from model');
            return [];
        }

        const shape = output.dims;
        const data = output.data;

        console.log('Model output shape:', shape);
        console.log('First 20 values:', Array.from(data.slice(0, 20)));

        let rawDetections = [];

        // Process different YOLO output formats
        if (shape.length === 3) {
            const [batch, values, numDetections] = shape;
            console.log(`Processing format: batch=${batch}, values=${values}, detections=${numDetections}`);

            // YOLOv8 transposed format: [1, 7, 8400] where values < numDetections
            if (values < numDetections) {
                rawDetections = processYOLOv8TransposedFormat(data, numDetections, values);
            }
            // Standard format: [1, 8400, 7]
            else {
                rawDetections = processYOLOStandardFormat(data, numDetections, values);
            }
        }

        // Filter by confidence threshold
        const confidenceThreshold = 0.8;
        const validDetections = rawDetections.filter(det =>
            det.confidence > confidenceThreshold &&
            det.classId >= 0 &&
            det.classId < CLASSES.length
        );

        console.log(`Found ${validDetections.length} valid detections (threshold: ${confidenceThreshold})`);

        // Apply Non-Maximum Suppression to remove duplicate detections
        const nmsDetections = applyNMS(validDetections, 0.45);
        console.log(`After NMS: ${nmsDetections.length} detections`);

        // Convert to display format
        return nmsDetections.map(det => ({
            class: CLASSES[det.classId],
            confidence: det.confidence,
            bbox: {
                x: Math.max(0, det.x - det.w / 2),
                y: Math.max(0, det.y - det.h / 2),
                width: det.w,
                height: det.h
            }
        }));
    };

    // Non-Maximum Suppression to remove overlapping detections
    const applyNMS = (detections, iouThreshold) => {
        if (detections.length === 0) return [];

        // Sort by confidence (highest first)
        const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
        const keep = [];

        while (sorted.length > 0) {
            const current = sorted.shift();
            keep.push(current);

            // Remove detections that overlap significantly with current
            const remaining = [];
            for (const det of sorted) {
                // Only compare detections of the same class
                if (det.classId !== current.classId) {
                    remaining.push(det);
                    continue;
                }

                const iou = calculateIOU(current, det);
                if (iou < iouThreshold) {
                    remaining.push(det);
                }
            }
            sorted.length = 0;
            sorted.push(...remaining);
        }

        return keep;
    };

    // Calculate Intersection over Union (IoU)
    const calculateIOU = (box1, box2) => {
        const x1_min = box1.x - box1.w / 2;
        const y1_min = box1.y - box1.h / 2;
        const x1_max = box1.x + box1.w / 2;
        const y1_max = box1.y + box1.h / 2;

        const x2_min = box2.x - box2.w / 2;
        const y2_min = box2.y - box2.h / 2;
        const x2_max = box2.x + box2.w / 2;
        const y2_max = box2.y + box2.h / 2;

        // Calculate intersection area
        const intersect_x_min = Math.max(x1_min, x2_min);
        const intersect_y_min = Math.max(y1_min, y2_min);
        const intersect_x_max = Math.min(x1_max, x2_max);
        const intersect_y_max = Math.min(y1_max, y2_max);

        const intersect_w = Math.max(0, intersect_x_max - intersect_x_min);
        const intersect_h = Math.max(0, intersect_y_max - intersect_y_min);
        const intersect_area = intersect_w * intersect_h;

        // Calculate union area
        const box1_area = box1.w * box1.h;
        const box2_area = box2.w * box2.h;
        const union_area = box1_area + box2_area - intersect_area;

        // Return IoU
        return union_area > 0 ? intersect_area / union_area : 0;
    };

    // Process YOLOv8 transposed format [1, 7, 8400]
    const processYOLOv8TransposedFormat = (data, numDetections, numValues) => {
        const detections = [];

        for (let i = 0; i < numDetections; i++) {
            // Get bounding box coordinates (normalized 0-1)
            const x = data[0 * numDetections + i] / MODEL_INPUT_SIZE;
            const y = data[1 * numDetections + i] / MODEL_INPUT_SIZE;
            const w = data[2 * numDetections + i] / MODEL_INPUT_SIZE;
            const h = data[3 * numDetections + i] / MODEL_INPUT_SIZE;

            // Get class probabilities (starting from index 4)
            let maxClassConf = 0;
            let bestClass = 0;

            for (let j = 4; j < numValues && j < 7; j++) {
                const classConf = data[j * numDetections + i];
                if (classConf > maxClassConf) {
                    maxClassConf = classConf;
                    bestClass = j - 4;
                }
            }

            detections.push({
                x, y, w, h,
                confidence: maxClassConf,
                classId: bestClass
            });
        }

        return detections;
    };

    // Process standard YOLO format [1, 8400, 7]
    const processYOLOStandardFormat = (data, numDetections, values) => {
        const detections = [];

        for (let i = 0; i < numDetections; i++) {
            const base = i * values;

            // Get bounding box
            const x = data[base] / MODEL_INPUT_SIZE;
            const y = data[base + 1] / MODEL_INPUT_SIZE;
            const w = data[base + 2] / MODEL_INPUT_SIZE;
            const h = data[base + 3] / MODEL_INPUT_SIZE;

            // Get objectness score (if present)
            const objConf = values > 5 ? data[base + 4] : 1.0;

            // Get class probabilities
            let maxClassConf = 0;
            let bestClass = 0;
            const startIdx = values > 5 ? 5 : 4;
            const maxClasses = Math.min(3, values - startIdx);

            for (let j = 0; j < maxClasses; j++) {
                const classConf = data[base + startIdx + j];
                if (classConf > maxClassConf) {
                    maxClassConf = classConf;
                    bestClass = j;
                }
            }

            detections.push({
                x, y, w, h,
                confidence: objConf * maxClassConf,
                classId: bestClass
            });
        }

        return detections;
    };

    const drawDetections = (ctx, detections) => {
        detections.forEach(detection => {
            const { bbox, class: className, confidence } = detection;
            const x = bbox.x * ctx.canvas.width;
            const y = bbox.y * ctx.canvas.height;
            const width = bbox.width * ctx.canvas.width;
            const height = bbox.height * ctx.canvas.height;

            ctx.strokeStyle = '#1E8449';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);

            const label = `${className} ${(confidence * 100).toFixed(1)}%`;
            ctx.font = '16px Arial';
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = '#1E8449';
            ctx.fillRect(x, y - 25, textWidth + 10, 25);
            ctx.fillStyle = 'white';
            ctx.fillText(label, x + 5, y - 7);
        });
    };

    // ===== TASK CREATION FUNCTIONS =====

    // Verify detection with Groq AI — draw bounding box on snapshot only, never on live feed
    const verifyAndCreateTask = async (detection, canvas) => {
        const { class: className, confidence, bbox } = detection;

        const centerX = (bbox.x + bbox.width / 2) * canvas.width;
        const centerY = (bbox.y + bbox.height / 2) * canvas.height;
        const key = `${Math.floor(centerX / 50)}_${Math.floor(centerY / 50)}`;

        if (detectedSitesRef.current.has(key)) return;

        // Capture clean frame (no bounding box) for Groq
        const cleanImageData = canvas.toDataURL('image/jpeg', 0.8);

        let confirmed = false;
        let groqResult = {};
        try {
            const verifyRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/task/verify-detection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageData: cleanImageData, detectedClass: className, confidenceScore: confidence })
            });
            groqResult = await verifyRes.json();
            confirmed = groqResult.confirmed === true;
            if (groqResult.groqUnavailable) {
                console.log(`⚠️ Groq unavailable — using YOLO result directly: ${groqResult.reason}`);
            } else {
                console.log(`🤖 Groq: ${confirmed ? '✅ Confirmed' : '❌ Rejected'} | class=${groqResult.detectedClass} severity=${groqResult.severity} priority=${groqResult.priority} | ${groqResult.reason}`);
            }
        } catch (err) {
            console.warn('Groq verification request failed, using YOLO result:', err.message);
            confirmed = true;
            groqResult = { groqUnavailable: true };
        }

        if (!confirmed) return;

        detectedSitesRef.current.add(key);

        // Draw bounding box on a fresh offscreen canvas (snapshot), not the live feed
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = canvas.width;
        snapCanvas.height = canvas.height;
        const snapCtx = snapCanvas.getContext('2d');

        // Copy the clean frame
        const img = new Image();
        img.src = cleanImageData;
        await new Promise(resolve => { img.onload = resolve; });
        snapCtx.drawImage(img, 0, 0);

        // Draw bounding box on snapshot
        const x = bbox.x * snapCanvas.width;
        const y = bbox.y * snapCanvas.height;
        const w = bbox.width * snapCanvas.width;
        const h = bbox.height * snapCanvas.height;

        snapCtx.strokeStyle = '#1E8449';
        snapCtx.lineWidth = 3;
        snapCtx.strokeRect(x, y, w, h);

        const label = `${className} ${(confidence * 100).toFixed(1)}%`;
        snapCtx.font = 'bold 18px Arial';
        const textWidth = snapCtx.measureText(label).width;
        snapCtx.fillStyle = '#1E8449';
        snapCtx.fillRect(x, y - 28, textWidth + 12, 28);
        snapCtx.fillStyle = 'white';
        snapCtx.fillText(label, x + 6, y - 8);

        const snapshotWithBox = snapCanvas.toDataURL('image/jpeg', 0.9);

        setDetectedSnapshots(prev => [
            { id: key, imageData: snapshotWithBox, className, confidence, timestamp: new Date() },
            ...prev.slice(0, 4)
        ]);

        setTaskStats(prev => ({ created: prev.created + 1, pending: prev.pending + 1 }));
        await createTask({ ...detection, imageData: cleanImageData }, canvas, groqResult);
    };

    // Calculate severity based on detection size (matching app.py logic)
    const calculateSeverity = (bbox, canvasWidth, canvasHeight) => {
        const detectionArea = bbox.width * bbox.height * canvasWidth * canvasHeight;
        const frameArea = canvasWidth * canvasHeight;
        const coveragePercentage = (detectionArea / frameArea) * 100;

        if (coveragePercentage >= 20) return "High";
        if (coveragePercentage >= 10) return "Medium";
        return "Low";
    };

    // Calculate priority based on class and severity (matching app.py logic)
    const calculatePriority = (className, severity) => {
        const classPriority = {
            "spills": "High",
            "garbage": "Medium",
            "bin": "Low"
        };

        const basePriority = classPriority[className.toLowerCase()] || "Low";
        const priorityLevels = { "High": 3, "Medium": 2, "Low": 1 };

        return priorityLevels[severity] > priorityLevels[basePriority]
            ? severity
            : basePriority;
    };

    // Get GPS coordinates
    const getGPSCoordinates = async () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.log('Geolocation not available');
                resolve({ latitude: null, longitude: null });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('GPS coordinates obtained');
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn('GPS error:', error.message);
                    resolve({ latitude: null, longitude: null });
                },
                { timeout: 5000, enableHighAccuracy: false }
            );
        });
    };

    // Create task in MongoDB (matching app.py structure)
    const createTask = async (detection, canvas, groqResult = {}) => {
        try {
            const { class: className, confidence, bbox, imageData: preCapuredImage } = detection;

            // Calculate center position
            const centerX = (bbox.x + bbox.width / 2) * canvas.width;
            const centerY = (bbox.y + bbox.height / 2) * canvas.height;

            // Calculate severity and priority
            const severity = calculateSeverity(bbox, canvas.width, canvas.height);
            const priority = calculatePriority(className, severity);

            // Get GPS coordinates
            const gps = await getGPSCoordinates();

            // Use pre-captured image from Groq verification step, or capture now
            const imageData = preCapuredImage || canvas.toDataURL('image/jpeg', 0.8);

            // Calculate bounding box coordinates for backend
            const x1 = bbox.x * canvas.width;
            const y1 = bbox.y * canvas.height;
            const x2 = (bbox.x + bbox.width) * canvas.width;
            const y2 = (bbox.y + bbox.height) * canvas.height;

            // Create task payload matching backend API expectations
            const taskData = {
                detectedClass: className,
                x1: x1.toString(),
                y1: y1.toString(),
                x2: x2.toString(),
                y2: y2.toString(),
                confidenceScore: confidence.toString(),
                frameHeight: canvas.height.toString(),
                frameWidth: canvas.width.toString(),
                latitude: gps.latitude?.toString() || '',
                longitude: gps.longitude?.toString() || '',
                cameraId: 'CAM1',
                imageData,
                // AI-provided fields from Groq (omitted when Groq is unavailable — backend uses computed values)
                ...(!groqResult.groqUnavailable && {
                    aiDetectedClass: groqResult.detectedClass || null,
                    aiSeverity: groqResult.severity || null,
                    aiPriority: groqResult.priority || null,
                    aiDepartment: groqResult.department || null
                })
            };
            console.log('Creating task (Groq verified)...');

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/task/detections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (result.success || response.ok) {
                console.log(`✅ Task created successfully`);
                return result;
            } else {
                throw new Error(result.error || 'Failed to create task');
            }

        } catch (error) {
            console.error('❌ Task creation failed:', error);
            return null;
        }
    };


    useEffect(() => {
        if (isOpen && modelLoaded) {
            startCamera();
        }
    }, [isOpen, modelLoaded]);

    const handleClose = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setStream(null);
        setDetections([]);
        setDetectedSnapshots([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-y-auto">
            <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-4">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Waste Detection Camera</h2>
                    <button onClick={handleClose} className="text-white hover:text-red-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Stats row */}
                <div className="flex gap-3">
                    <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
                        <div className="text-[#1E8449] text-2xl font-bold">{taskStats.created}</div>
                        <div className="text-neutral-400 text-xs mt-1">Tasks Created</div>
                    </div>
                    <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
                        <div className="text-yellow-500 text-2xl font-bold">{taskStats.pending}</div>
                        <div className="text-neutral-400 text-xs mt-1">Pending</div>
                    </div>
                    <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
                        <div className={`text-2xl font-bold ${stream ? 'text-green-500' : 'text-neutral-500'}`}>
                            {stream ? 'Live' : 'Off'}
                        </div>
                        <div className="text-neutral-400 text-xs mt-1">Camera</div>
                    </div>
                </div>

                {/* Clean live camera feed — no overlays */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                    <div className="bg-neutral-800 px-4 py-2 border-b border-neutral-700 flex items-center gap-2">
                        {stream && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />}
                        <span className="text-white text-sm font-medium">Live Feed</span>
                    </div>
                    <div className="relative aspect-video bg-neutral-950">
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-white text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E8449] mx-auto mb-3" />
                                    <p className="text-sm">Loading model...</p>
                                </div>
                            </div>
                        )}
                        {error && (
                            <div className="absolute top-3 left-3 right-3 bg-yellow-500/90 text-white p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            playsInline
                            muted
                            autoPlay
                            style={{ display: stream ? 'block' : 'none' }}
                        />
                        {/* Hidden canvas used only for inference — never visible */}
                        <canvas ref={canvasRef} className="hidden" />
                        {!stream && !isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center text-neutral-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-3 text-[#1E8449]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="text-sm">Point camera at waste items</p>
                                    <p className="text-xs text-neutral-600 mt-1">AI will detect and classify automatically</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Verified detections with bounding boxes */}
                {detectedSnapshots.length > 0 && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                        <div className="bg-neutral-800 px-4 py-2 border-b border-neutral-700">
                            <span className="text-white text-sm font-medium">Verified Detections</span>
                        </div>
                        <div className="p-3 flex gap-3 overflow-x-auto">
                            {detectedSnapshots.map((snap) => (
                                <div key={snap.id} className="flex-shrink-0 bg-neutral-800 rounded-lg overflow-hidden w-48 border border-neutral-700">
                                    <img src={snap.imageData} alt={snap.className} className="w-full h-32 object-cover" />
                                    <div className="p-2">
                                        <div className="text-white text-sm font-semibold capitalize">{snap.className}</div>
                                        <div className="text-[#1E8449] text-xs">{(snap.confidence * 100).toFixed(1)}% confidence</div>
                                        <div className="text-neutral-500 text-xs mt-1">{snap.timestamp.toLocaleTimeString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="text-center text-neutral-600 text-xs pb-2">
                    AI-powered waste detection • Groq vision verification
                    {modelLoaded && !sessionRef.current && ' • Demo Mode'}
                </div>
            </div>
        </div>
    );
}