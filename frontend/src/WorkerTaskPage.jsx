import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Camera, X, RefreshCw, MapPin,
  Clock, ChevronLeft, ChevronRight, ZoomIn
} from 'lucide-react';
import { useCameraContext } from './CameraContext';

const API = 'http://localhost:5000/api/task';

const STATUS_COLORS = {
  'Incomplete': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  'In Progress': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'Completed': 'bg-green-500/20 text-green-400 border border-green-500/30',
};

const PRIORITY_COLORS = { High: 'text-red-400', Medium: 'text-yellow-400', Low: 'text-green-400' };

// ── Auto-capture countdown overlay ───────────────────────────────────────────
function AutoCaptureOverlay({ task, onCapture, onCancel }) {
  const { cameraActive, captureFrame } = useCameraContext();
  const [countdown, setCountdown] = useState(3);
  const [snapshot, setSnapshot] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [noCameraWarning, setNoCameraWarning] = useState(false);

  useEffect(() => {
    if (!cameraActive) {
      setNoCameraWarning(true);
      return;
    }

    if (countdown === 0) {
      // Take the shot
      const frame = captureFrame(task.location);
      if (frame) {
        setSnapshot(frame);
      } else {
        setNoCameraWarning(true);
      }
      return;
    }

    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, cameraActive]);

  const confirm = async () => {
    setUploading(true);
    await onCapture(snapshot);
    setUploading(false);
  };

  const retake = () => {
    if (!cameraActive) { setNoCameraWarning(true); return; }
    setSnapshot(null);
    setCountdown(3);
    setNoCameraWarning(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Mark Task Complete</h2>
            <p className="text-gray-400 text-xs mt-0.5">{task.location} · {task._id?.slice(-8).toUpperCase()}</p>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {noCameraWarning && !snapshot ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
              <Camera className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-yellow-400 text-sm font-medium">Camera is not active</p>
              <p className="text-gray-400 text-xs mt-1">Start the camera on the Camera page first, then come back to complete this task.</p>
              <button onClick={onCancel} className="mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                Go Back
              </button>
            </div>
          ) : !snapshot ? (
            /* Countdown */
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#374151" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke="#22c55e" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (countdown / 3)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">{countdown}</span>
                </div>
              </div>
              <p className="text-gray-300 text-sm">Auto-capturing from live camera...</p>
              <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-xs underline">Cancel</button>
            </div>
          ) : (
            /* Preview snapshot */
            <div className="space-y-3">
              <p className="text-gray-400 text-xs text-center">Screenshot captured from live camera</p>
              <div className="aspect-video rounded-xl overflow-hidden border border-green-500/30">
                <img src={snapshot} alt="completion screenshot" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-3">
                <button onClick={retake} className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  <RefreshCw className="w-4 h-4" /> Retake
                </button>
                <button
                  onClick={confirm}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {uploading ? 'Submitting...' : 'Confirm Complete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Before/After comparison modal ────────────────────────────────────────────
function ComparisonModal({ task, onClose }) {
  const [zoom, setZoom] = useState(null); // 'before' | 'after'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Before / After Comparison</h2>
            <p className="text-gray-400 text-xs mt-0.5">Task ID: {task._id?.slice(-8).toUpperCase()} · {task.location}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Before */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">Before (Detection)</span>
              <button onClick={() => setZoom('before')} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-red-500/20">
              {task.imagePath ? (
                <img src={task.imagePath} alt="before" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No image available</div>
              )}
            </div>
            <p className="text-gray-500 text-xs">Detected: {new Date(task.createdAt).toLocaleString()}</p>
          </div>

          {/* After */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-green-400 uppercase tracking-wider">After (Completion)</span>
              <button onClick={() => setZoom('after')} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-green-500/20">
              {task.completionImage ? (
                <img src={task.completionImage} alt="after" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No completion photo</div>
              )}
            </div>
            <p className="text-gray-500 text-xs">
              Completed: {task.completedAt ? new Date(task.completedAt).toLocaleString() : '—'}
            </p>
          </div>
        </div>

        {/* Task details strip */}
        <div className="mx-4 mb-4 bg-gray-800 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-gray-500 text-xs">Department</p><p className="capitalize text-white">{task.department}</p></div>
          <div><p className="text-gray-500 text-xs">Priority</p><p className={`font-semibold ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</p></div>
          <div><p className="text-gray-500 text-xs">Severity</p><p className="text-white">{task.severity}</p></div>
          <div><p className="text-gray-500 text-xs">Status</p><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>{task.status}</span></div>
        </div>
      </div>

      {/* Zoom overlay */}
      {zoom && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-60 p-4" onClick={() => setZoom(null)}>
          <img
            src={zoom === 'before' ? task.imagePath : task.completionImage}
            alt={zoom}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
          <button className="absolute top-4 right-4 p-2 bg-gray-800 rounded-full" onClick={() => setZoom(null)}>
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkerTaskPage() {
  const { cameraActive, getStream } = useCameraContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [captureTask, setCaptureTask] = useState(null);   // task being completed
  const [compareTask, setCompareTask] = useState(null);   // task for comparison view
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 12, sortBy: 'createdAt', sortOrder: 'desc' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API}/assigned-tasks?${params}`);
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [currentPage, statusFilter]);

  const handleCapture = async (imageData) => {
    try {
      const res = await fetch(`${API}/detections/${captureTask._id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Task marked as completed');
        setTasks(prev => prev.map(t => t._id === captureTask._id ? data.data : t));
        const completed = data.data;
        setCaptureTask(null);
        // Auto-open comparison
        setCompareTask(completed);
      } else {
        showToast('Failed to complete task', 'error');
        setCaptureTask(null);
      }
    } catch (e) {
      showToast('Network error', 'error');
      setCaptureTask(null);
    }
  };

  return (
    <div className="text-white min-h-screen">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
          <div>
            <h1 className="text-2xl font-bold">Worker Task Completion</h1>
            <p className="text-gray-400 text-sm">{total} assigned tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-500"
          >
            <option value="">All Statuses</option>
            <option value="Incomplete">Incomplete</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <button onClick={fetchTasks} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Task Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <CheckCircle2 className="w-12 h-12 mb-3 opacity-30" />
          <p>No tasks found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              onComplete={() => setCaptureTask(task)}
              onCompare={() => setCompareTask(task)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {captureTask && (
        <AutoCaptureOverlay task={captureTask} onCapture={handleCapture} onCancel={() => setCaptureTask(null)} />
      )}
      {compareTask && (
        <ComparisonModal task={compareTask} onClose={() => setCompareTask(null)} />
      )}
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onComplete, onCompare }) {
  const isCompleted = task.status === 'Completed';

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden flex flex-col transition-all
      ${isCompleted ? 'border-green-500/30' : 'border-gray-800 hover:border-gray-700'}`}>

      {/* Detection image */}
      <div className="relative aspect-video bg-black">
        {task.imagePath ? (
          <img src={task.imagePath} alt="detection" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <Camera className="w-10 h-10" />
          </div>
        )}
        {/* Status badge */}
        <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full ${STATUS_COLORS[task.status]}`}>
          {task.status}
        </span>
        {/* Priority badge */}
        <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full bg-black/60 ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-blue-400">{task._id?.slice(-8).toUpperCase()}</span>
          <span className="text-xs text-gray-500 capitalize">{task.department}</span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <MapPin className="w-3 h-3" /> {task.location}
        </div>

        {/* Assigned worker */}
        {task.assignedWorker && (
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-2 py-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              {task.assignedWorker.firstName?.[0]}{task.assignedWorker.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{task.assignedWorker.firstName} {task.assignedWorker.lastName}</p>
              <p className="text-gray-500 text-xs capitalize">{task.assignedWorker.shift} · {task.assignedWorker.department}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 text-gray-600 text-xs mt-auto">
          <Clock className="w-3 h-3" /> {new Date(task.createdAt).toLocaleString()}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex gap-2">
        {!isCompleted ? (
          <button
            onClick={onComplete}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Camera className="w-4 h-4" /> Mark Complete
          </button>
        ) : (
          <button
            onClick={onCompare}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <ZoomIn className="w-4 h-4" /> View Comparison
          </button>
        )}
        {isCompleted && task.completionImage && (
          <button
            onClick={onCompare}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm transition-colors"
            title="Before/After"
          >
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </button>
        )}
      </div>
    </div>
  );
}
