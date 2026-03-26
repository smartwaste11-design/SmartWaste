import React, { useState, useEffect } from 'react';
import {
  ClipboardList, User, RefreshCw, Filter, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertTriangle, X, Phone, Mail, MapPin, Briefcase
} from 'lucide-react';

const API = 'http://localhost:5000/api/task';

const STATUS_COLORS = {
  'Incomplete': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  'In Progress': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'Completed': 'bg-green-500/20 text-green-400 border border-green-500/30',
};

const PRIORITY_COLORS = {
  'High': 'text-red-400',
  'Medium': 'text-yellow-400',
  'Low': 'text-green-400',
};

const SEVERITY_COLORS = {
  'High': 'bg-red-500/20 text-red-400',
  'Medium': 'bg-yellow-500/20 text-yellow-400',
  'Low': 'bg-green-500/20 text-green-400',
};

export default function TaskAssignmentPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    status: '', department: '', priority: '', severity: ''
  });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 15, sortBy: 'createdAt', sortOrder: 'desc' });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`${API}/assigned-tasks?${params}`);
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch (e) {
      console.error('Error fetching tasks:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [currentPage, filters]);

  const updateStatus = async (taskId, status) => {
    setUpdatingId(taskId);
    try {
      const res = await fetch(`${API}/assigned-tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.map(t => t._id === taskId ? data.data : t));
        if (selectedTask?._id === taskId) setSelectedTask(data.data);
      }
    } catch (e) {
      console.error('Error updating status:', e);
    }
    setUpdatingId(null);
  };

  const clearFilters = () => {
    setFilters({ status: '', department: '', priority: '', severity: '' });
    setCurrentPage(1);
  };

  const hasFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="text-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Task Assignments</h1>
            <p className="text-gray-400 text-sm">{total} assigned tasks</p>
          </div>
        </div>
        <button onClick={fetchTasks} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        {[
          { key: 'status', options: ['Incomplete', 'In Progress', 'Completed'] },
          { key: 'department', options: ['cleaning', 'spill'] },
          { key: 'priority', options: ['High', 'Medium', 'Low'] },
          { key: 'severity', options: ['High', 'Medium', 'Low'] },
        ].map(({ key, options }) => (
          <select
            key={key}
            value={filters[key]}
            onChange={e => { setFilters(p => ({ ...p, [key]: e.target.value })); setCurrentPage(1); }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 capitalize"
          >
            <option value="">{key.charAt(0).toUpperCase() + key.slice(1)}: All</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/30 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <ClipboardList className="w-12 h-12 mb-3 opacity-30" />
            <p>No assigned tasks found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Task</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Priority / Severity</th>
                  <th className="px-4 py-3 text-left">Assigned Worker</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {tasks.map(task => (
                  <tr key={task._id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedTask(task)}
                        className="text-blue-400 hover:text-blue-300 font-mono text-xs underline underline-offset-2"
                      >
                        {task._id.slice(-8).toUpperCase()}
                      </button>
                      <p className="text-gray-400 text-xs mt-0.5">{task.location}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize px-2 py-1 bg-gray-800 rounded text-gray-300 text-xs">{task.department}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                      <span className="text-gray-600 mx-1">/</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[task.severity]}`}>{task.severity}</span>
                    </td>
                    <td className="px-4 py-3">
                      {task.assignedWorker ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                            {task.assignedWorker.firstName?.[0]}{task.assignedWorker.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-white text-xs font-medium">{task.assignedWorker.firstName} {task.assignedWorker.lastName}</p>
                            <p className="text-gray-500 text-xs capitalize">{task.assignedWorker.shift} shift</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[task.status]}`}>{task.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(task.createdAt).toLocaleDateString()}<br />
                      <span className="text-gray-600">{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={task.status}
                        disabled={updatingId === task._id}
                        onChange={e => updateStatus(task._id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      >
                        <option value="Incomplete">Incomplete</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-bold">Task Details</h2>
              <button onClick={() => setSelectedTask(null)} className="p-1 hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Task Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Task ID</p>
                  <p className="font-mono text-xs text-blue-400">{selectedTask._id}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[selectedTask.status]}`}>{selectedTask.status}</span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Department</p>
                  <p className="capitalize text-sm">{selectedTask.department}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Location</p>
                  <p className="text-sm flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-500" />{selectedTask.location}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Priority</p>
                  <p className={`font-semibold text-sm ${PRIORITY_COLORS[selectedTask.priority]}`}>{selectedTask.priority}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Severity</p>
                  <span className={`text-xs px-2 py-1 rounded ${SEVERITY_COLORS[selectedTask.severity]}`}>{selectedTask.severity}</span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Size</p>
                  <p className="text-sm">{selectedTask.size} px²</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Created</p>
                  <p className="text-xs text-gray-300">{new Date(selectedTask.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedTask.description && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Description</p>
                  <p className="text-sm text-gray-300">{selectedTask.description}</p>
                </div>
              )}

              {/* Worker Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" /> Assigned Worker
                </h3>
                {selectedTask.assignedWorker ? (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                        {selectedTask.assignedWorker.firstName?.[0]}{selectedTask.assignedWorker.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{selectedTask.assignedWorker.firstName} {selectedTask.assignedWorker.lastName}</p>
                        <p className="text-gray-400 text-xs capitalize">{selectedTask.assignedWorker.department} · {selectedTask.assignedWorker.shift} shift</p>
                      </div>
                      {selectedTask.assignedWorker.available === false && (
                        <span className="ml-auto text-xs px-2 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full">On Task</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs">{selectedTask.assignedWorker.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs">{selectedTask.assignedWorker.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs">{selectedTask.assignedWorker.location}</span>
                      </div>
                      {selectedTask.assignedWorker.emergencyResponder && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="text-xs text-yellow-400">Emergency Responder</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-xl p-4 text-center text-gray-500 text-sm">
                    No worker assigned
                  </div>
                )}
              </div>

              {/* Update Status */}
              <div>
                <p className="text-gray-500 text-xs mb-2">Update Status</p>
                <div className="flex gap-2">
                  {['Incomplete', 'In Progress', 'Completed'].map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedTask._id, s)}
                      disabled={selectedTask.status === s || updatingId === selectedTask._id}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                        ${selectedTask.status === s ? STATUS_COLORS[s] : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
