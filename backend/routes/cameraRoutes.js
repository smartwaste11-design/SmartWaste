import express from 'express';

const router = express.Router();

// In-memory store for the latest admin camera snapshot
// { imageData: base64string, timestamp: Date, cameraId: string }
let latestSnapshot = null;

// POST /api/camera/snapshot — admin camera pushes frames here
router.post('/snapshot', (req, res) => {
  const { imageData, cameraId = 'ADMIN_CAM' } = req.body;
  if (!imageData) return res.status(400).json({ success: false, error: 'imageData required' });

  latestSnapshot = { imageData, cameraId, timestamp: new Date() };
  res.json({ success: true });
});

// GET /api/camera/snapshot/latest — worker completion flow reads from here
router.get('/snapshot/latest', (req, res) => {
  if (!latestSnapshot) {
    return res.status(404).json({ success: false, error: 'No snapshot available. Admin camera may not be running.' });
  }

  const ageSeconds = (Date.now() - new Date(latestSnapshot.timestamp).getTime()) / 1000;

  // Warn if snapshot is stale (> 30 seconds)
  res.json({
    success: true,
    imageData: latestSnapshot.imageData,
    cameraId: latestSnapshot.cameraId,
    timestamp: latestSnapshot.timestamp,
    ageSeconds: Math.round(ageSeconds),
    stale: ageSeconds > 30
  });
});

// GET /api/camera/status — check if admin camera is live
router.get('/status', (req, res) => {
  if (!latestSnapshot) {
    return res.json({ online: false, message: 'No snapshot received yet' });
  }
  const ageSeconds = (Date.now() - new Date(latestSnapshot.timestamp).getTime()) / 1000;
  res.json({
    online: ageSeconds <= 30,
    cameraId: latestSnapshot.cameraId,
    lastSeen: latestSnapshot.timestamp,
    ageSeconds: Math.round(ageSeconds)
  });
});

export default router;
export { latestSnapshot };
