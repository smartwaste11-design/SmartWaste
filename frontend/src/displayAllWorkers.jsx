import { useEffect, useState } from "react";
import { Edit, Trash2, UserPlus, X } from "lucide-react";

const EMPTY_WORKER = {
  firstName: "", lastName: "", email: "", phone: "", age: "",
  gender: "male", department: "cleaning", shift: "morning",
  location: "", available: true, emergencyResponder: false,
  startDate: "", additionalDetails: ""
};

const inputClass = "w-full bg-gray-700 text-gray-200 rounded-md p-2 mt-1 focus:outline-none focus:ring-2 focus:ring-purple-500";
const labelClass = "block text-sm font-medium text-gray-300";

function WorkerModal({ title, worker, onChange, onSubmit, onClose, submitLabel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name</label>
                <input required type="text" value={worker.firstName}
                  onChange={e => onChange("firstName", e.target.value)}
                  className={inputClass} placeholder="John" />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input type="text" value={worker.lastName}
                  onChange={e => onChange("lastName", e.target.value)}
                  className={inputClass} placeholder="Doe" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input required type="email" value={worker.email}
                onChange={e => onChange("email", e.target.value)}
                className={inputClass} placeholder="worker@example.com" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Phone</label>
                <input required type="text" value={worker.phone}
                  onChange={e => onChange("phone", e.target.value)}
                  className={inputClass} placeholder="+1234567890" />
              </div>
              <div>
                <label className={labelClass}>Age</label>
                <input required type="number" min="18" max="70" value={worker.age}
                  onChange={e => onChange("age", e.target.value)}
                  className={inputClass} placeholder="25" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Gender</label>
                <select value={worker.gender} onChange={e => onChange("gender", e.target.value)} className={inputClass}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Start Date</label>
                <input type="date" value={worker.startDate ? worker.startDate.slice(0, 10) : ""}
                  onChange={e => onChange("startDate", e.target.value)}
                  className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Department</label>
                <select value={worker.department} onChange={e => onChange("department", e.target.value)} className={inputClass}>
                  <option value="cleaning">Cleaning</option>
                  <option value="spill">Spill</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Shift</label>
                <select value={worker.shift} onChange={e => onChange("shift", e.target.value)} className={inputClass}>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Location</label>
              <input type="text" value={worker.location}
                onChange={e => onChange("location", e.target.value)}
                className={inputClass} placeholder="e.g. Zone A, Floor 2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Availability</label>
                <div className="flex items-center mt-3">
                  <button type="button"
                    onClick={() => onChange("available", !worker.available)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${worker.available ? "bg-green-600" : "bg-gray-600"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${worker.available ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className={`ml-3 text-sm font-medium ${worker.available ? "text-green-400" : "text-red-400"}`}>
                    {worker.available ? "Available" : "Unavailable"}
                  </span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Emergency Responder</label>
                <div className="flex items-center mt-3">
                  <button type="button"
                    onClick={() => onChange("emergencyResponder", !worker.emergencyResponder)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${worker.emergencyResponder ? "bg-yellow-500" : "bg-gray-600"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${worker.emergencyResponder ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className={`ml-3 text-sm font-medium ${worker.emergencyResponder ? "text-yellow-400" : "text-gray-400"}`}>
                    {worker.emergencyResponder ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Additional Details</label>
              <textarea value={worker.additionalDetails || ""}
                onChange={e => onChange("additionalDetails", e.target.value)}
                rows={2} className={inputClass} placeholder="Any additional notes..." />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-md transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="bg-purple-700 hover:bg-purple-600 text-white py-2 px-4 rounded-md transition-colors">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const DisplayAllWorkers = () => {
  const url = import.meta.env.VITE_API_URL;
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [newWorker, setNewWorker] = useState(EMPTY_WORKER);

  useEffect(() => { fetchWorkers(); }, []);

  const fetchWorkers = async () => {
    try {
      const response = await fetch(`${url}worker`);
      if (!response.ok) throw new Error("Failed to fetch worker data");
      const data = await response.json();
      setWorkers(data.sort((a, b) => {
        if (a.department !== b.department) return a.department.localeCompare(b.department);
        if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
        return a.gender.localeCompare(b.gender);
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (workerId) => {
    setSelectedWorker({ ...workers.find(w => w._id === workerId) });
    setIsEditModalOpen(true);
  };

  const handleEditChange = (field, value) => setSelectedWorker(prev => ({ ...prev, [field]: value }));
  const handleAddChange = (field, value) => setNewWorker(prev => ({ ...prev, [field]: value }));

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${url}worker/${selectedWorker._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedWorker)
      });
      if (!res.ok) throw new Error("Failed to update worker");
      await fetchWorkers();
      setIsEditModalOpen(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${url}worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorker)
      });
      if (!res.ok) throw new Error("Failed to add worker");
      await fetchWorkers();
      setIsAddModalOpen(false);
      setNewWorker(EMPTY_WORKER);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemove = async (workerId) => {
    if (!confirm("Are you sure you want to delete this worker?")) return;
    try {
      const res = await fetch(`${url}worker/${workerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete worker");
      await fetchWorkers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) return <div className="text-white">Loading...</div>;
  if (error) return (
    <div className="bg-gray-900 rounded-lg p-6 border border-red-500/50">
      <p className="text-center text-red-400 text-lg">{error}</p>
      <button onClick={fetchWorkers} className="mt-4 mx-auto block bg-purple-700 hover:bg-purple-600 text-white py-2 px-4 rounded-md">Try Again</button>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-red-500/50">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white">All Workers</h1>
        <button
          onClick={() => { setNewWorker(EMPTY_WORKER); setIsAddModalOpen(true); }}
          className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white py-2 px-4 rounded-lg text-sm transition-colors"
        >
          <UserPlus size={16} /> Add Worker
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-800">
              {["Name", "Phone", "Department", "Location", "Shift", "Emergency Responder", "Available", "Edit", "Remove"].map(h => (
                <th key={h} className="p-3 border border-gray-700 text-white text-sm">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map(worker => (
              <tr key={worker._id} className="bg-gray-700 hover:bg-gray-600">
                <td className="p-3 border border-gray-600 text-white">{worker.firstName} {worker.lastName}</td>
                <td className="p-3 border border-gray-600 text-white">{worker.phone}</td>
                <td className="p-3 border border-gray-600 text-white capitalize">{worker.department}</td>
                <td className="p-3 border border-gray-600 text-white">{worker.location || "Not specified"}</td>
                <td className="p-3 border border-gray-600 text-white capitalize">{worker.shift}</td>
                <td className="p-3 border border-gray-600 text-white text-center">{worker.emergencyResponder ? "Yes" : "No"}</td>
                <td className="p-3 border border-gray-600 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${worker.available ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                    {worker.available ? "Available" : "Unavailable"}
                  </span>
                </td>
                <td className="p-3 border border-gray-600 text-center">
                  <button onClick={() => handleEdit(worker._id)} className="text-teal-400 hover:text-teal-300">
                    <Edit size={18} />
                  </button>
                </td>
                <td className="p-3 border border-gray-600 text-center">
                  <button onClick={() => handleRemove(worker._id)} className="text-red-400 hover:text-red-300">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {workers.map(worker => (
          <div key={worker._id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-white">{worker.firstName} {worker.lastName}</h3>
                <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-semibold ${worker.available ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                  {worker.available ? "Available" : "Unavailable"}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(worker._id)} className="p-2 bg-teal-900/50 text-teal-400 hover:bg-teal-900 rounded-md">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleRemove(worker._id)} className="p-2 bg-red-900/50 text-red-400 hover:bg-red-900 rounded-md">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400 text-xs">Phone</p><p className="text-white">{worker.phone}</p></div>
              <div><p className="text-gray-400 text-xs">Department</p><p className="text-white capitalize">{worker.department}</p></div>
              <div><p className="text-gray-400 text-xs">Location</p><p className="text-white">{worker.location || "Not specified"}</p></div>
              <div><p className="text-gray-400 text-xs">Shift</p><p className="text-white capitalize">{worker.shift}</p></div>
              <div className="col-span-2"><p className="text-gray-400 text-xs">Emergency Responder</p><p className="text-white">{worker.emergencyResponder ? "Yes" : "No"}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedWorker && (
        <WorkerModal
          title="Edit Worker"
          worker={selectedWorker}
          onChange={handleEditChange}
          onSubmit={handleEditSubmit}
          onClose={() => setIsEditModalOpen(false)}
          submitLabel="Save Changes"
        />
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <WorkerModal
          title="Add New Worker"
          worker={newWorker}
          onChange={handleAddChange}
          onSubmit={handleAddSubmit}
          onClose={() => setIsAddModalOpen(false)}
          submitLabel="Add Worker"
        />
      )}
    </div>
  );
};

export default DisplayAllWorkers;
