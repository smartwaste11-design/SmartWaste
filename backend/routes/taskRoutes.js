import express from 'express';
import mongoose from 'mongoose';
import { Task } from '../taskModel.js';
import Worker from '../Models/Worker.js';

const router = express.Router();

// GET all tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DEBUG: check raw docs for a worker (remove after confirming)
router.get('/worker/:workerId/debug', async (req, res) => {
  try {
    const raw = await mongoose.connection.db
      .collection('tasks')
      .find({})
      .limit(5)
      .toArray();

    const sample = raw.map(d => ({
      _id: d._id,
      assignedWorker: d.assignedWorker,
      assignedWorkerType: typeof d.assignedWorker,
      status: d.status,
      assigned: d.assigned
    }));

    res.json({ requested: req.params.workerId, sample });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET tasks assigned to a specific worker
router.get('/worker/:workerId', async (req, res) => {
  try {
    let workerId;
    try {
      workerId = new mongoose.Types.ObjectId(req.params.workerId);
    } catch {
      return res.status(400).json({ message: 'Invalid workerId format' });
    }
    // Use lean() + Task model (same 'tasks' collection) — returns raw docs with all fields
    const tasks = await Task.find({ assignedWorker: workerId })
      .lean()
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update task status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // If task is completed and was assigned to a worker, check if all their tasks are done
    if (status === 'Completed' && task.assignedWorker) {
      const pendingTasks = await Task.countDocuments({
        assignedWorker: task.assignedWorker,
        status: { $ne: 'Completed' }
      });

      if (pendingTasks === 0) {
        await Worker.findByIdAndUpdate(task.assignedWorker, { available: true });
      }
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
