import express from 'express';
import { 
  createReport,
  getAllReports,
  getUserReports,
  getReportById,
  updateReport,
  deleteReport,
  updateReportStatus
} from '../controllers/reportController.js';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

const router = express.Router();

// Apply Clerk authentication middleware to all routes
// This will ensure the user is authenticated via Clerk before accessing any route
const requireAuth = ClerkExpressRequireAuth();

// Public endpoint — report map locations (no auth needed for landing page map)
router.get('/map-locations', async (req, res) => {
  try {
    const reports = await (await import('../Models/Report.js')).default.find(
      { latitude: { $ne: null }, longitude: { $ne: null } },
      { latitude: 1, longitude: 1, waste_type: 1, location_type: 1, status: 1, estimated_quantity: 1, reportedAt: 1, imageUrl: 1 }
    ).sort({ reportedAt: -1 }).limit(200);
    res.json({ success: true, locations: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a new report
router.post('/', requireAuth, createReport);

// Get all reports
router.get('/', requireAuth, getAllReports);

// Get current user's reports
router.get('/user', requireAuth, getUserReports);

// Get a specific report by ID
router.get('/:id', requireAuth, getReportById);

// Update a report
router.put('/:id', requireAuth, updateReport);

// Delete a report
router.delete('/:id', requireAuth, deleteReport);

// Update report status (potentially admin-only)
router.put('/:id/:status', updateReportStatus);

export default router;