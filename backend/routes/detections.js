import express from 'express';
import Detection from '../Models/Detection.js';
import { Task } from '../taskModel.js';
import Worker from '../Models/Worker.js';
import cloudinary from '../config/cloudinary.js';
import Groq from 'groq-sdk';
import { latestSnapshot } from './cameraRoutes.js';

const router = express.Router();

// Only init Groq client if API key is present
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// Second Groq client for completion verification (separate key to distribute load)
const groqVerifyClient = process.env.GROQ_API_KEY_2
  ? new Groq({ apiKey: process.env.GROQ_API_KEY_2 })
  : groqClient; // fallback to primary if secondary not set

// VERIFY detection with Groq vision — also extracts class, priority, severity, department
router.post('/verify-detection', async (req, res) => {
  const { imageData, detectedClass, confidenceScore } = req.body;

  if (!imageData) {
    return res.status(400).json({ success: false, error: 'imageData is required' });
  }

  // If Groq is not configured, fall back to YOLO result immediately
  if (!groqClient) {
    console.log('⚠️ GROQ_API_KEY not set — skipping AI verification, using YOLO result');
    return res.json({ success: true, confirmed: true, groqUnavailable: true, reason: 'Groq not configured' });
  }

  try {
    const chat = await groqClient.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageData }
            },
            {
              type: 'text',
              text: `A YOLO model detected "${detectedClass}" with ${(parseFloat(confidenceScore) * 100).toFixed(1)}% confidence in this image.

Analyze the image carefully and respond with ONLY a JSON object in this exact format (no extra text):
{
  "confirmed": true or false,
  "reason": "brief explanation",
  "detectedClass": "garbage" or "bin" or "spills" or "none",
  "severity": "High" or "Medium" or "Low",
  "priority": "High" or "Medium" or "Low",
  "department": "cleaning" or "spill"
}

Rules:
- confirmed: true only if waste, garbage, a bin, or a liquid spill is clearly visible
- detectedClass: the most accurate class based on what you see (garbage=loose trash/litter, bin=waste container, spills=liquid spill)
- severity: High if waste covers >20% of frame, Medium if 5-20%, Low if <5%
- priority: High for garbage, Medium for bin, Low for spills
- severity and priority should NOT both be Low unless the detection is extremely minor — if one is Low the other should be at least Medium
- department: "spill" only for liquid spills, "cleaning" for everything else`
            }
          ]
        }
      ],
      max_tokens: 200,
      temperature: 0.1
    });

    const content = chat.choices[0]?.message?.content?.trim();
    let result;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      result = null;
    }

    if (!result) {
      console.warn('⚠️ Groq returned unparseable response — falling back to YOLO result');
      return res.json({ success: true, confirmed: true, groqUnavailable: true, reason: 'Could not parse AI response' });
    }

    // Validate and sanitize AI fields
    const validClasses = ['bin', 'garbage', 'spills'];
    const validLevels = ['High', 'Medium', 'Low'];
    const validDepts = ['cleaning', 'spill'];

    if (!validClasses.includes(result.detectedClass)) result.detectedClass = detectedClass;
    if (!validLevels.includes(result.severity)) result.severity = 'Low';
    if (!validLevels.includes(result.priority)) result.priority = 'Low';
    if (!validDepts.includes(result.department)) result.department = 'cleaning';

    // Ensure severity and priority are never both Low
    if (result.severity === 'Low' && result.priority === 'Low') {
      result.priority = 'Medium';
    }

    console.log(`🤖 Groq for "${detectedClass}": ${result.confirmed ? '✅' : '❌'} | class=${result.detectedClass} severity=${result.severity} priority=${result.priority} dept=${result.department} | ${result.reason}`);

    return res.json({ success: true, ...result });

  } catch (error) {
    // Any Groq error (quota exceeded, network, invalid key, etc.) — fall back gracefully
    console.warn(`⚠️ Groq unavailable (${error.message}) — falling back to YOLO result`);
    return res.json({ success: true, confirmed: true, groqUnavailable: true, reason: `Groq error: ${error.message}` });
  }
});

// Helper functions
const calculateSeverity = (width, height, frameHeight, frameWidth) => {
  const detectionArea = width * height;
  const frameArea = frameHeight * frameWidth;
  const coveragePercentage = (detectionArea / frameArea) * 100;

  if (coveragePercentage >= 20) return "High";
  if (coveragePercentage >= 5) return "Medium";
  return "Low";
};

const calculatePriority = (className, severity) => {
  const classPriority = {
    spills: "Low",
    garbage: "High",
    bin: "Medium"
  };

  const basePriority = classPriority[className.toLowerCase()] || "Medium";
  const priorityLevels = { High: 3, Medium: 2, Low: 1 };

  return priorityLevels[severity] > priorityLevels[basePriority] ? severity : basePriority;
};

// CREATE detection with Cloudinary upload
router.post('/detections', async (req, res) => {
  try {
    const {
      detectedClass,
      x1, y1, x2, y2,
      confidenceScore,
      frameHeight = 640,
      frameWidth = 640,
      latitude = null,
      longitude = null,
      cameraId = 'CAM1',
      imageData,
      // AI-provided fields from Groq (override computed values when present)
      aiDetectedClass,
      aiSeverity,
      aiPriority,
      aiDepartment
    } = req.body;

    const centerX = (parseFloat(x1) + parseFloat(x2)) / 2;
    const centerY = (parseFloat(y1) + parseFloat(y2)) / 2;
    const width = parseFloat(x2) - parseFloat(x1);
    const height = parseFloat(y2) - parseFloat(y1);
    const detectionSize = width * height;
    const coveragePercentage = (detectionSize / (frameHeight * frameWidth)) * 100;

    // Use AI-provided values if available, otherwise fall back to computed
    const finalClass = aiDetectedClass || detectedClass;
    const severity = aiSeverity || calculateSeverity(width, height, frameHeight, frameWidth);
    const priority = aiPriority || calculatePriority(finalClass, severity);
    const department = aiDepartment || (finalClass.toLowerCase() !== "spills" ? "cleaning" : "spill");
    const location = `${cameraId}-${Math.round(centerX)}-${Math.round(centerY)}`;

    // Upload image to Cloudinary
    let imageUrl = null;
    let cloudinaryPublicId = null;
    let uploadWarning = null;

    if (imageData) {
      try {
        const uploadResult = await cloudinary.uploader.upload(imageData, {
          folder: 'waste-detection',
          resource_type: 'image',
          public_id: `detection_${Date.now()}`,
          transformation: [
            { width: 1280, height: 720, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        });

        imageUrl = uploadResult.secure_url;
        cloudinaryPublicId = uploadResult.public_id;
        console.log(`✅ Image uploaded to Cloudinary: ${imageUrl}`);
      } catch (uploadError) {
        console.error('⚠️ Cloudinary upload failed:', uploadError.message);
        uploadWarning = `Image upload failed: ${uploadError.message}. Detection saved without image.`;
        // Continue without image - don't fail the entire request
      }
    }

    const detectionData = {
      size: detectionSize,
      department,
      severity,
      priority,
      location,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      assigned: false,
      assignedWorker: null,
      processing: false,
      status: "Incomplete",
      description: `Detected ${finalClass} with ${parseFloat(confidenceScore).toFixed(2)} confidence.${aiDetectedClass ? ' (AI verified)' : ''}`,
      imagePath: imageUrl || `detection_${Date.now()}.jpg`,
      cloudinaryPublicId,
      locationDetails: {
        x: centerX,
        y: centerY,
        width,
        height,
        coveragePercentage
      },
      confidenceScore: parseFloat(confidenceScore),
      detectedClass: finalClass,
      cameraId
    };

    const savedDetection = await new Detection(detectionData).save();

    console.log(`✅ Detection stored with ID: ${savedDetection._id}`);

    const response = {
      success: true,
      id: savedDetection._id,
      data: savedDetection,
      message: `Detection stored successfully`
    };

    // Add warning if image upload failed
    if (uploadWarning) {
      response.warning = uploadWarning;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error storing detection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET detections with lat/long for map display
router.get('/detections/map-locations', async (req, res) => {
  try {
    const detections = await Detection.find(
      { latitude: { $ne: null }, longitude: { $ne: null } },
      { latitude: 1, longitude: 1, detectedClass: 1, severity: 1, priority: 1, status: 1, cameraId: 1, createdAt: 1, imagePath: 1 }
    ).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, locations: detections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// READ all detections with filters
router.get('/detections', async (req, res) => {
  try {
    const {
      status = null,
      assigned = null,
      department = null,
      severity = null,
      priority = null,
      limit = 50,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (assigned !== null) filter.assigned = assigned === 'true';
    if (department) filter.department = department;
    if (severity) filter.severity = severity;
    if (priority) filter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const detections = await Detection.find(filter).sort(sort).skip(skip).limit(parseInt(limit));
    const total = await Detection.countDocuments(filter);

    res.json({
      success: true,
      data: detections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching detections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// READ by ID
router.get('/detections/:id', async (req, res) => {
  try {
    const detection = await Detection.findById(req.params.id);
    if (!detection) return res.status(404).json({ success: false, message: 'Detection not found' });
    res.json({ success: true, data: detection });
  } catch (error) {
    console.error('Error fetching detection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE detection
router.put('/detections/:id', async (req, res) => {
  try {
    const { assigned, assignedWorker, processing, status } = req.body;
    const updateData = {};
    if (assigned !== undefined) updateData.assigned = assigned;
    if (assignedWorker !== undefined) updateData.assignedWorker = assignedWorker;
    if (processing !== undefined) updateData.processing = processing;
    if (status !== undefined) updateData.status = status;

    const detection = await Detection.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!detection) return res.status(404).json({ success: false, message: 'Detection not found' });

    res.json({ success: true, data: detection, message: 'Detection updated successfully' });
  } catch (error) {
    console.error('Error updating detection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE detection
router.delete('/detections/:id', async (req, res) => {
  try {
    const detection = await Detection.findByIdAndDelete(req.params.id);
    if (!detection) return res.status(404).json({ success: false, message: 'Detection not found' });

    // Delete image from Cloudinary if it exists
    if (detection.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(detection.cloudinaryPublicId);
        console.log(`✅ Deleted image from Cloudinary: ${detection.cloudinaryPublicId}`);
      } catch (cloudinaryError) {
        console.log('Could not delete image from Cloudinary:', cloudinaryError.message);
      }
    }

    res.json({ success: true, message: 'Detection deleted successfully' });
  } catch (error) {
    console.error('Error deleting detection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ANALYTICS: summary stats
router.get('/detections/stats/summary', async (req, res) => {
  try {
    const stats = await Detection.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          assigned: { $sum: { $cond: ['$assigned', 1, 0] } },
          unassigned: { $sum: { $cond: ['$assigned', 0, 1] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          incomplete: { $sum: { $cond: [{ $eq: ['$status', 'Incomplete'] }, 1, 0] } },
          highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] } },
          mediumPriority: { $sum: { $cond: [{ $eq: ['$priority', 'Medium'] }, 1, 0] } },
          lowPriority: { $sum: { $cond: [{ $eq: ['$priority', 'Low'] }, 1, 0] } },
          avgConfidence: { $avg: '$confidenceScore' }
        }
      }
    ]);

    const departmentStats = await Detection.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          avgSeverity: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ['$severity', 'High'] }, then: 3 },
                  { case: { $eq: ['$severity', 'Medium'] }, then: 2 },
                  { case: { $eq: ['$severity', 'Low'] }, then: 1 }
                ]
              }
            }
          }
        }
      }
    ]);

    const classStats = await Detection.aggregate([
      {
        $group: {
          _id: '$detectedClass',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidenceScore' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overall: stats[0] || {},
        byDepartment: departmentStats,
        byClass: classStats
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all assigned tasks with populated worker details
router.get('/assigned-tasks', async (req, res) => {
  try {
    const {
      status = '',
      department = '',
      priority = '',
      severity = '',
      workerId = '',
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { assigned: true };
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (priority) filter.priority = priority;
    if (severity) filter.severity = severity;
    if (workerId) filter.assignedWorker = workerId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const tasks = await Task.find(filter)
      .populate('assignedWorker', 'firstName lastName email phone department shift location available emergencyResponder')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(filter);

    res.json({
      success: true,
      data: tasks,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update task status (for admin)
router.put('/assigned-tasks/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Incomplete', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const task = await Task.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('assignedWorker', 'firstName lastName email phone department shift location');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT mark task complete — uses latest admin camera snapshot for AI verification
router.put('/detections/:id/complete', async (req, res) => {
  try {
    // Fetch the original task to get the before image
    const task = await Detection.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // ── Pull latest admin camera snapshot ────────────────────────────────────
    if (!latestSnapshot) {
      return res.status(503).json({
        success: false,
        error: 'Admin camera is not running. Please ensure the admin camera page is open.'
      });
    }

    const ageSeconds = (Date.now() - new Date(latestSnapshot.timestamp).getTime()) / 1000;
    if (ageSeconds > 120) {
      return res.status(503).json({
        success: false,
        error: `Admin camera snapshot is stale (${Math.round(ageSeconds)}s old). Please ensure the admin camera is active.`
      });
    }

    const imageData = latestSnapshot.imageData;
    console.log(`📷 Using admin camera snapshot from ${latestSnapshot.cameraId} (${Math.round(ageSeconds)}s ago)`);

    // ── Groq before/after verification ──────────────────────────────────────
    let verified = false;
    let verificationReason = 'Groq verification unavailable';

    if (groqVerifyClient && task.imagePath) {
      try {
        console.log('🔍 Running Groq before/after verification...');
        const chat = await groqVerifyClient.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are a waste management task verification system. A worker has submitted an AFTER image to mark a cleanup task as complete.

BEFORE image: shows the original detected waste/spill (${task.detectedClass}, ${task.severity} severity).
AFTER image: submitted by the worker as proof of completion.

Your ONLY job is to check the AFTER image for the presence of waste or spills.

Respond with ONLY a JSON object in this exact format (no extra text):
{
  "verified": true or false,
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation of what you see in the AFTER image"
}

Rules:
- verified: true if the AFTER image does NOT clearly show active waste, garbage, or spills (e.g. clean area, dustbin, person, blank/dark screen, indoor scene, any non-waste scene)
- verified: false ONLY if the AFTER image clearly and obviously still shows the same unresolved waste or spill
- Do NOT compare scenes or locations between BEFORE and AFTER — they may look completely different
- Give benefit of the doubt: if unsure, set verified: true`
                },
                {
                  type: 'text',
                  text: 'BEFORE image (original detection):'
                },
                {
                  type: 'image_url',
                  image_url: { url: task.imagePath }
                },
                {
                  type: 'text',
                  text: 'AFTER image (admin camera snapshot at time of worker completion):'
                },
                {
                  type: 'image_url',
                  image_url: { url: imageData }
                }
              ]
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        });

        const content = chat.choices[0]?.message?.content?.trim();
        const jsonMatch = content?.match(/\{[\s\S]*\}/);
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (result) {
          verified = result.verified === true;
          verificationReason = result.reason || 'No reason provided';
          console.log(`🤖 Groq verification: ${verified ? '✅ Verified' : '❌ Rejected'} | ${verificationReason}`);
        } else {
          verified = true;
          verificationReason = 'Could not parse AI response — marked complete by default';
          console.warn('⚠️ Groq returned unparseable response, defaulting to verified');
        }
      } catch (groqErr) {
        verified = true;
        verificationReason = `Groq verification failed (${groqErr.message}) — marked complete by default`;
        console.error('⚠️ Groq verification error:', groqErr.message);
      }
    } else {
      verified = true;
      verificationReason = task.imagePath ? 'Groq client not configured' : 'No before image to compare';
    }

    if (!verified) {
      return res.status(422).json({
        success: false,
        verified: false,
        reason: verificationReason,
        message: 'Task completion rejected by AI verification. The area does not appear to be cleaned.'
      });
    }

    // ── Upload completion screenshot to Cloudinary ───────────────────────────
    let completionImageUrl = null;
    try {
      const uploadResult = await cloudinary.uploader.upload(imageData, {
        folder: 'waste-detection/completions',
        resource_type: 'image',
        public_id: `completion_${req.params.id}_${Date.now()}`,
        transformation: [{ width: 1280, height: 720, crop: 'limit' }, { quality: 'auto:good' }]
      });
      completionImageUrl = uploadResult.secure_url;
    } catch (uploadErr) {
      console.error('Cloudinary upload failed for completion image:', uploadErr.message);
      completionImageUrl = null;
    }

    const updated = await Detection.findByIdAndUpdate(
      req.params.id,
      { status: 'Completed', completionImage: completionImageUrl, completedAt: new Date() },
      { new: true }
    );

    // If task was assigned to a worker, check if all their tasks are now completed
    if (updated.assignedWorker) {
      const pendingCount = await Detection.countDocuments({
        assignedWorker: updated.assignedWorker,
        status: { $ne: 'Completed' }
      });

      if (pendingCount === 0) {
        await Worker.findByIdAndUpdate(updated.assignedWorker, { available: true });
        console.log(`✅ Worker ${updated.assignedWorker} marked as available — all tasks completed`);
      }
    }

    res.json({
      success: true,
      verified: true,
      verificationReason,
      snapshotAge: Math.round(ageSeconds),
      data: updated
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;