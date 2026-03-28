import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const BACKEND = import.meta.env.VITE_BACKEND_URL;

const severityColors = { High: "#ef4444", Medium: "#f97316", Low: "#22c55e" };

const makeIcon = (severity, status) => {
  const color = severityColors[severity] || "#60a5fa";
  const isDone = status === "Completed";
  const inner = isDone
    ? `<path d="M5 13l4 4L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<circle cx="12" cy="10" r="3" fill="white"/>`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/></filter>
      <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 26 14 26S32 26 32 16C32 8.268 25.732 2 18 2z"
        fill="${color}" filter="url(#s)"/>
      ${inner}
    </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
};

const reverseGeocode = async (lat, lon) => {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const data = await res.json();
    return (
      data.locality ||
      data.city ||
      data.principalSubdivision ||
      data.countryName ||
      "Unknown"
    );
  } catch {}
  return "Unknown";
};

// Spread overlapping markers using golden-angle spiral jitter
const jitter = (lat, lon, registry) => {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const count = registry.get(key) || 0;
  registry.set(key, count + 1);
  if (count === 0) return [lat, lon];
  const angle = (count - 1) * 137.5 * (Math.PI / 180);
  const radius = 0.00015 * Math.ceil(count / 8);
  return [lat + radius * Math.cos(angle), lon + radius * Math.sin(angle)];
};

const statusColor = { Completed: "#22c55e", "In Progress": "#38bdf8", Incomplete: "#f59e0b" };

function MapMarkers({ detections, reports = [] }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const registry = new Map();

    detections.forEach(async (d) => {
      const [jLat, jLon] = jitter(d.latitude, d.longitude, registry);
      const place = await reverseGeocode(d.latitude, d.longitude);
      const marker = L.marker([jLat, jLon], {
        icon: makeIcon(d.severity, d.status),
      }).addTo(map);

      const col = statusColor[d.status] || "#94a3b8";
      const time = new Date(d.createdAt).toLocaleString();

      marker.bindPopup(`
        <div style="min-width:180px;font-family:sans-serif;line-height:1.6">
          <div style="font-weight:700;font-size:0.95em;margin-bottom:4px">📍 ${place}</div>
          <div>🗑️ <b>${d.detectedClass || "—"}</b></div>
          <div>⚡ Severity: <b style="color:${severityColors[d.severity] || '#fff'}">${d.severity || "—"}</b></div>
          <div>🎯 Priority: <b>${d.priority || "—"}</b></div>
          <div>Status: <b style="color:${col}">${d.status || "—"}</b></div>
          <div style="font-size:0.75em;color:#888;margin-top:2px">🕐 ${time}</div>
          ${d.imagePath ? `<img src="${d.imagePath}" style="width:100%;margin-top:8px;border-radius:6px;max-height:120px;object-fit:cover"/>` : ""}
        </div>
      `);
      marker.on("mouseover", function () { this.openPopup(); });
      marker.on("mouseout", function () { this.closePopup(); });
      markersRef.current.push(marker);
    });

    reports.forEach(async (r) => {
      const [jLat, jLon] = jitter(r.latitude, r.longitude, registry);
      const place = await reverseGeocode(r.latitude, r.longitude);
      const reportPinIcon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
          <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/></filter>
          <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 26 14 26S32 26 32 16C32 8.268 25.732 2 18 2z"
            fill="#a855f7" filter="url(#s)"/>
          <text x="18" y="20" text-anchor="middle" font-size="12" fill="white">👤</text>
        </svg>`,
        className: "",
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -44],
      });
      const marker = L.marker([jLat, jLon], { icon: reportPinIcon }).addTo(map);
      const col = r.status === 'accepted' ? '#22c55e' : '#f59e0b';
      const time = new Date(r.reportedAt).toLocaleString();

      marker.bindPopup(`
        <div style="min-width:180px;font-family:sans-serif;line-height:1.6">
          <div style="font-weight:700;color:#a855f7;margin-bottom:4px">👤 Citizen Report</div>
          <div>📍 <b>${place}</b></div>
          ${r.waste_type ? `<div>🗑️ ${r.waste_type}</div>` : ''}
          ${r.estimated_quantity ? `<div>📦 Quantity: ${r.estimated_quantity}</div>` : ''}
          ${r.location_type ? `<div>📌 ${r.location_type}</div>` : ''}
          <div>Status: <b style="color:${col}">${r.status}</b></div>
          <div style="font-size:0.75em;color:#888;margin-top:2px">🕐 ${time}</div>
          ${r.imageUrl ? `<img src="${r.imageUrl}" style="width:100%;margin-top:8px;border-radius:6px;max-height:120px;object-fit:cover"/>` : ""}
        </div>
      `);
      marker.on("mouseover", function () { this.openPopup(); });
      marker.on("mouseout", function () { this.closePopup(); });
      markersRef.current.push(marker);
    });
  }, [detections, reports, map]);

  return null;
}

export default function AdminMapPage() {
  const [detections, setDetections] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, incomplete: 0, inProgress: 0, completed: 0, reports: 0 });

  const fetchDetections = async () => {
    setLoading(true);
    try {
      const [detRes, repRes] = await Promise.allSettled([
        fetch(`${BACKEND}/api/task/detections/map-locations`),
        fetch(`${BACKEND}/api/reports/map-locations`)
      ]);

      let locs = [];
      if (detRes.status === 'fulfilled' && detRes.value.ok) {
        const data = await detRes.value.json();
        locs = data.locations || [];
      }
      let reps = [];
      if (repRes.status === 'fulfilled' && repRes.value.ok) {
        const data = await repRes.value.json();
        reps = data.locations || [];
      }

      setDetections(locs);
      setReports(reps);
      setStats({
        total: locs.length,
        incomplete: locs.filter((d) => d.status === "Incomplete").length,
        inProgress: locs.filter((d) => d.status === "In Progress").length,
        completed: locs.filter((d) => d.status === "Completed").length,
        reports: reps.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetections();
    const id = setInterval(fetchDetections, 30000);
    return () => clearInterval(id);
  }, []);

  const filtered = filter === "all" ? detections : detections.filter((d) => d.status === filter);

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Detection Map</h2>
        <button
          onClick={fetchDetections}
          className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1.5 rounded-lg"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total", val: stats.total, color: "text-blue-400" },
          { label: "Incomplete", val: stats.incomplete, color: "text-yellow-400" },
          { label: "In Progress", val: stats.inProgress, color: "text-sky-400" },
          { label: "Completed", val: stats.completed, color: "text-green-400" },
          { label: "Reports", val: stats.reports, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "Incomplete", "In Progress", "Completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f
                ? "bg-green-600 border-green-500 text-white"
                : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-gray-400 flex-wrap">
        <span>🔴 High severity</span>
        <span>🟠 Medium severity</span>
        <span>🟢 Low severity</span>
        <span style={{color:'#a855f7'}}>🟣 Citizen report</span>
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-700" style={{ height: "520px" }}>
        {loading ? (
          <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400">
            Loading map…
          </div>
        ) : (
          <MapContainer center={[20, 78]} zoom={5} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapMarkers detections={filtered} reports={reports} />
          </MapContainer>
        )}
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-center text-gray-500 mt-4 text-sm">
          No detections with GPS coordinates found.
        </p>
      )}
    </div>
  );
}
