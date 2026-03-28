import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import sampleImage from "./sample.png"; // Adjust the path as needed
import OpenImageVideo from "./OpenImageVideo";

// Blue Marker Icon for detected locations
const severityColors = { High: '#ef4444', Medium: '#f97316', Low: '#22c55e' };

const makePinIcon = (color) => L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter>
    <path d="M16 2C9.373 2 4 7.373 4 14c0 9 12 24 12 24S28 23 28 14C28 7.373 22.627 2 16 2z"
      fill="${color}" filter="url(#s)"/>
    <circle cx="16" cy="14" r="4" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

const blueIcon = makePinIcon('#3b82f6');
const reportIcon = makePinIcon('#a855f7'); // purple for citizen reports

const severityIcon = (severity) => {
  const color = severityColors[severity] || '#3b82f6';
  return makePinIcon(color);
};

const reverseGeocode = async (lat, lon) => {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const data = await res.json();
    return data.locality || data.city || data.principalSubdivision || data.countryName || 'Unknown location';
  } catch {}
  return 'Unknown location';
};

// Spread overlapping markers using golden-angle spiral
const jitter = (lat, lon, registry) => {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const count = registry.get(key) || 0;
  registry.set(key, count + 1);
  if (count === 0) return [lat, lon];
  const angle = (count - 1) * 137.5 * (Math.PI / 180);
  const radius = 0.00015 * Math.ceil(count / 8);
  return [lat + radius * Math.cos(angle), lon + radius * Math.sin(angle)];
};

// Map component to display garbage locations and detected locations
const MapControl = ({ detectedLocations, reportLocations }) => {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const registry = new Map();

    // Add detected locations to map
    detectedLocations.forEach(async (loc) => {
      const [jLat, jLon] = jitter(loc.latitude, loc.longitude, registry);
      const cityName = await reverseGeocode(loc.latitude, loc.longitude);
      const icon = loc.severity ? severityIcon(loc.severity) : blueIcon;
      const marker = L.marker([jLat, jLon], { icon }).addTo(map);
      const detectionTime = new Date(loc.timestamp || loc.createdAt).toLocaleString();
      const sc = { Completed: '#22c55e', 'In Progress': '#38bdf8', Incomplete: '#f59e0b' }[loc.status] || '#94a3b8';

      marker.bindPopup(`
        <div style="min-width:160px;line-height:1.6">
          <strong>📍 ${cityName}</strong><br/>
          ${loc.detectedClass ? `🗑️ ${loc.detectedClass}<br/>` : ''}
          ${loc.severity ? `⚡ Severity: <b>${loc.severity}</b><br/>` : ''}
          ${loc.status ? `Status: <b style="color:${sc}">${loc.status}</b><br/>` : ''}
          <span style="font-size:0.8em;color:#888">🕐 ${detectionTime}</span>
        </div>`);
      marker.on('mouseover', function () { this.openPopup(); });
      marker.on('mouseout', function () { this.closePopup(); });
      marker.on('click', function () { map.flyTo([loc.latitude, loc.longitude], 15, { animate: true, duration: 1 }); });
      markersRef.current.push(marker);
    });

    // Add citizen report locations to map
    reportLocations.forEach(async (rep) => {
      const [jLat, jLon] = jitter(rep.latitude, rep.longitude, registry);
      const cityName = await reverseGeocode(rep.latitude, rep.longitude);
      const marker = L.marker([jLat, jLon], { icon: reportIcon }).addTo(map);
      const reportTime = new Date(rep.reportedAt).toLocaleString();
      const sc = rep.status === 'accepted' ? '#22c55e' : '#f59e0b';

      marker.bindPopup(`
        <div style="min-width:160px;line-height:1.6">
          <strong>📍 ${cityName}</strong><br/>
          <span style="color:#a855f7;font-weight:600">👤 Citizen Report</span><br/>
          ${rep.waste_type ? `🗑️ ${rep.waste_type}<br/>` : ''}
          ${rep.estimated_quantity ? `📦 Quantity: ${rep.estimated_quantity}<br/>` : ''}
          ${rep.location_type ? `📌 ${rep.location_type}<br/>` : ''}
          Status: <b style="color:${sc}">${rep.status}</b><br/>
          <span style="font-size:0.8em;color:#888">🕐 ${reportTime}</span>
          ${rep.imageUrl ? `<img src="${rep.imageUrl}" style="width:100%;margin-top:6px;border-radius:6px;max-height:100px;object-fit:cover"/>` : ''}
        </div>`);
      marker.on('mouseover', function () { this.openPopup(); });
      marker.on('mouseout', function () { this.closePopup(); });
      marker.on('click', function () { map.flyTo([rep.latitude, rep.longitude], 15, { animate: true, duration: 1 }); });
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, detectedLocations, reportLocations]);

  return null;
};

export default function WasteMap() {
  const [file, setFile] = useState(null);
  const [detectedLocations, setDetectedLocations] = useState([]);
  const [reportLocations, setReportLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([20, 78]);
  const [mapZoom, setMapZoom] = useState(5);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  // Function to fetch detected locations from the API
  const fetchDetectedLocations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch detections and citizen reports in parallel
      const [detectRes, reportRes] = await Promise.allSettled([
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/task/detections/map-locations`),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/reports/map-locations`)
      ]);

      let locations = [];
      if (detectRes.status === 'fulfilled' && detectRes.value.ok) {
        const data = await detectRes.value.json();
        locations = data.locations || [];
      }
      if (locations.length === 0) {
        try {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/location/get-location`);
          if (res.ok) { const d = await res.json(); locations = d.locations || []; }
        } catch {}
      }

      let reports = [];
      if (reportRes.status === 'fulfilled' && reportRes.value.ok) {
        const data = await reportRes.value.json();
        reports = data.locations || [];
      }

      setDetectedLocations(locations);
      setReportLocations(reports);

      const total = locations.length + reports.length;
      const statusElement = document.getElementById('location-status');
      if (statusElement) statusElement.textContent = `${locations.length} detections, ${reports.length} reports`;
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError(err.message);
      const statusElement = document.getElementById('location-status');
      if (statusElement) statusElement.textContent = 'Failed to fetch locations';
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle location selection from the list
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setMapCenter([location.latitude, location.longitude]);
    setMapZoom(15);

    // Update coordinates display
    const coordsDisplay = document.getElementById('coordinates-display');
    const latDisplay = document.getElementById('lat-display');
    const lngDisplay = document.getElementById('lng-display');

    if (coordsDisplay && latDisplay && lngDisplay) {
      coordsDisplay.classList.remove('hidden');
      latDisplay.textContent = location.latitude;
      lngDisplay.textContent = location.longitude;
    }
  };

  // Fetch locations when component mounts
  useEffect(() => {
    fetchDetectedLocations();

    // Set up interval to refresh locations every 30 seconds
    const intervalId = setInterval(fetchDetectedLocations, 30000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div>
      <section id="map-interface" className="py-16 px-18 bg-white dark:bg-neutral-800 ">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800 dark:text-white">
              Waste Detection & Map Interface
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              View and manage detected garbage locations with our intuitive mapping system.
            </p>
          </div>

          {/* Main Content Area - Restructured */}
          <div className="flex flex-col gap-8" >
            {/* Map Section with Information - Combined */}
            <div className="bg-white dark:bg-neutral-700 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gray-200 dark:bg-neutral-600 p-4">
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-green-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Live Map View
                </h3>
              </div>

              <div className="flex flex-col lg:flex-row">
                {/* Left Side: Map */}
                <div className="lg:w-2/3 w-full">
                  {/* Map Container */}
                  <div id="map" className="h-96 w-full bg-gray-50 dark:bg-neutral-900 relative overflow-hidden z-10">
                    <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapControl detectedLocations={detectedLocations} reportLocations={reportLocations} />
                    </MapContainer>
                  </div>

                  {/* Map Info Panel */}
                  <div className="p-4 border-t border-gray-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${isLoading ? 'bg-yellow-500 animate-pulse' : detectedLocations.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Location status:{" "}
                          <span id="location-status">
                            {isLoading ? 'Loading...' :
                              error ? 'Error loading locations' :
                                detectedLocations.length > 0 ? `${detectedLocations.length} locations detected` :
                                  'No locations detected'}
                          </span>
                        </span>
                      </div>
                      <div>
                        <button
                          id="map-refresh-btn"
                          className="p-2 hover:bg-gray-300 dark:hover:bg-neutral-500 rounded-full transition"
                          title="Refresh map"
                          onClick={() => fetchDetectedLocations()}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Coordinates Display */}
                    <div
                      id="coordinates-display"
                      className={`mt-3 p-3 bg-gray-50 dark:bg-neutral-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 ${selectedLocation ? '' : 'hidden'}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Current Coordinates</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Latitude:
                          </span>
                          <span id="lat-display">{selectedLocation ? selectedLocation.latitude.toFixed(6) : '--'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Longitude:
                          </span>
                          <span id="lng-display">{selectedLocation ? selectedLocation.longitude.toFixed(6) : '--'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Map Information */}
                <div className="lg:w-1/3 w-full p-6 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-neutral-700">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white mb-2">About This Map</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">
                        This interactive map displays all detected waste locations in real-time. Each marker represents a location where waste has been identified and reported by our community.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white mb-2">Map Features</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <li>Interactive navigation with pan and zoom</li>
                        <li>Location details on marker click</li>
                        <li>Automatic location retrieval</li>
                        <li>Real-time updates every 30 seconds</li>
                        <li>🔴🟠🟢 AI detections by severity</li>
                        <li style={{color:'#a855f7'}}>🟣 Citizen reported complaints</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Camera Section with Information - Combined */}
            <div className="bg-white dark:bg-neutral-700 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gray-200 dark:bg-neutral-600 p-4">
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Waste Detection & Classification
                </h3>
              </div>

              <div className="flex flex-col lg:flex-row ">
                {/* Left Side: Camera Interface */}
                <div className="lg:w-2/3 w-full p-6 ">
                  <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
                    {/* Camera Preview */}
                    <div className="md:w-1/2">
                      <div
                        id="camera-placeholder"
                        className="bg-gray-100 dark:bg-neutral-600 h-48 w-full rounded-lg flex items-center justify-center"
                      >
                        <img src={sampleImage} alt="Uploaded" className="h-full w-full object-cover rounded-lg" />
                      </div>
                      {/* Hidden video element for camera feed */}
                      <video
                        id="camera-feed"
                        className="hidden h-48 w-full rounded-lg object-cover"
                        autoPlay=""
                      />
                      {/* Captured image will be shown here */}
                      <canvas
                        id="capture-canvas"
                        className="hidden h-48 w-full rounded-lg object-cover"
                      />
                    </div>


                  </div>
                  <div className="space-y-4 mt-10">
                    <OpenImageVideo />
                    <div
                      id="camera-status"
                      className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300"
                    >
                      Click "Upload Image " to begin the detection process
                    </div>
                  </div>
                </div>

                {/* Right Side: Detection Information */}
                <div className="lg:w-1/3 w-full p-6 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-neutral-700">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white mb-2">AI-Powered Detection</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">
                        Our system uses advanced AI algorithms to detect and classify different types of waste from images captured by users. The model can identify various categories of waste with high accuracy.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white mb-2">Waste Categories</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                          <span className="text-gray-700 dark:text-gray-300">Plastic</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                          <span className="text-gray-700 dark:text-gray-300">Paper</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-gray-700 dark:text-gray-300">Glass</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                          <span className="text-gray-700 dark:text-gray-300">Metal</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                          <span className="text-gray-700 dark:text-gray-300">E-waste</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-gray-500 mr-2"></div>
                          <span className="text-gray-700 dark:text-gray-300">Mixed Waste</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>
      </section>
    </div>
  );
}
