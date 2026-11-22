import React, { useState, useEffect } from 'react';
import { apiFetch, fmt, fmtDate } from '../api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function FarmerPortal({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [farmerData, setFarmerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('--');

  // Fields
  const [sensField, setSensField] = useState('');
  const [npkField, setNpkField] = useState('A');
  const [npkLoading, setNpkLoading] = useState(false);
  const [npkResult, setNpkResult] = useState(null);
  const [npkError, setNpkError] = useState('');

  // History Tab
  const [histField, setHistField] = useState('A');
  const [histSource, setHistSource] = useState('thingspeak');
  const [histDays, setHistDays] = useState('30');
  const [historyRecords, setHistoryRecords] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const farmerName = user.farmer;

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/get_all_data?farmer=${encodeURIComponent(farmerName)}`);
      setFarmerData(res);
      setLastUpdate(new Date().toLocaleTimeString('en-IN'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const runNpkPrediction = async () => {
    setNpkLoading(true);
    setNpkError('');
    setNpkResult(null);
    try {
      const res = await apiFetch(`/predict?farmer=${farmerName}&field=${npkField}`);
      if (res.error) {
        setNpkError(res.error);
      } else {
        setNpkResult(res);
      }
    } catch (e) {
      setNpkError(e.message || 'Prediction failed');
    } finally {
      setNpkLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistLoading(true);
    setHistoryRecords([]);
    try {
      const res = await apiFetch(`/get_history?farmer=${encodeURIComponent(farmerName)}&field=${encodeURIComponent(histField)}&days=${histDays}`);
      const srcData = res?.data?.[histSource] || [];
      setHistoryRecords(Array.isArray(srcData) ? srcData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistLoading(false);
    }
  };

  const exportCSV = () => {
    if (!historyRecords.length) return alert('No history data to export.');
    const cols = Object.keys(historyRecords[0]).filter((k) => k !== '_id');
    let csv = cols.join(',') + '\n';
    historyRecords.forEach((row) => {
      csv += cols.map((col) => {
        let v = row[col];
        if (v && typeof v === 'object' && v.$date) v = new Date(v.$date).toISOString();
        return `"${String(v ?? '').replace(/"/g, '""')}"`;
      }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aahar_${farmerName}_history_${Date.now()}.csv`;
    a.click();
  };

  const tsFields = farmerData?.['ThingSpeak Data']?.[farmerName] || {};
  const nasaFields = farmerData?.['NASA LaRC Data']?.[farmerName] || {};
  const geeFields = farmerData?.['GEE Data']?.[farmerName] || {};

  const firstField = Object.values(tsFields)[0] || {};
  const firstNasa = Object.values(nasaFields)[0] || {};

  return (
    <div className="flex h-screen overflow-hidden bg-green-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col flex-shrink-0 z-20">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-3xl font-bold hindi text-green-800">आहार</h1>
          <span className="text-xs text-gray-400 tracking-widest uppercase font-medium mt-1 block">Farmer React Portal</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'My Dashboard', icon: 'dashboard' },
            { id: 'sensors', label: 'My Sensors', icon: 'sensors' },
            { id: 'npk', label: 'NPK Prediction', icon: 'analytics' },
            { id: 'satellite', label: 'Satellite Data', icon: 'satellite_alt' },
            { id: 'history', label: 'History', icon: 'history' },
          ].map((nav) => (
            <button
              key={nav.id}
              onClick={() => setActiveTab(nav.id)}
              className={`w-full flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === nav.id
                  ? 'bg-green-100 text-green-800 font-semibold'
                  : 'text-gray-700 hover:bg-green-50'
              }`}
            >
              <span className="material-icons text-xl mr-3">{nav.icon}</span>
              {nav.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center px-3 py-2 mb-2">
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
              {farmerName[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-green-600 font-medium">{farmerName}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition"
          >
            <span className="material-icons text-xl mr-3">logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800 capitalize">{activeTab.replace('-', ' ')}</h2>
            <p className="text-xs text-gray-400">Live farm sensors & satellite insights</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-700 font-medium">Auto-Refreshed Live</span>
            </div>
            <button onClick={loadData} className="text-gray-400 hover:text-green-700 transition">
              <span className="material-icons text-lg">refresh</span>
            </button>
            <span className="text-xs text-gray-400">Updated: {lastUpdate}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Welcome banner */}
              <div className="bg-gradient-to-r from-green-700 to-green-500 rounded-2xl p-6 text-white flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-green-200 text-sm mb-1">Welcome back,</p>
                  <h3 className="text-2xl font-bold">{user.name}</h3>
                  <p className="text-green-200 text-sm mt-1">Here is your live precision farming overview for today</p>
                </div>
                <div className="hidden md:flex items-center gap-4 text-right">
                  <div>
                    <p className="text-green-200 text-xs">Active Fields</p>
                    <p className="text-xl font-bold">{Object.keys(tsFields).length} Fields</p>
                  </div>
                  <span className="material-icons text-6xl text-green-300">agriculture</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
                  <p className="text-xs text-gray-500 uppercase mb-1">Soil pH</p>
                  <p className="text-3xl font-bold text-green-700">{fmt(firstField.hp, 1)}</p>
                  <p className="text-xs text-gray-400 mt-1">Optimal Range: 6.0–7.5</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
                  <p className="text-xs text-gray-500 uppercase mb-1">Air Temperature</p>
                  <p className="text-3xl font-bold text-blue-700">{fmt(firstNasa.T2M, 1)} °C</p>
                  <p className="text-xs text-gray-400 mt-1">NASA POWER Daily</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-yellow-500">
                  <p className="text-xs text-gray-500 uppercase mb-1">Humidity</p>
                  <p className="text-3xl font-bold text-yellow-700">{fmt(firstNasa.RH2M, 1)} %</p>
                  <p className="text-xs text-gray-400 mt-1">Relative Humidity</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-500">
                  <p className="text-xs text-gray-500 uppercase mb-1">Electrical Cond.</p>
                  <p className="text-3xl font-bold text-purple-700">{fmt(firstField.c, 2)} µS</p>
                  <p className="text-xs text-gray-400 mt-1">Conductivity Index</p>
                </div>
              </div>

              {/* Field Cards */}
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Your Monitored Fields</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Object.entries(tsFields).map(([field, d]) => {
                  const nasa = nasaFields[field] || {};
                  return (
                    <div key={field} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h4 className="text-lg font-bold text-gray-800">Field {field}</h4>
                          <p className="text-xs text-gray-400">{fmtDate(d.timestamp)}</p>
                        </div>
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">Telemetry Active</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <span className="material-icons text-purple-500 text-sm">science</span>
                          <p className="text-xs text-gray-400 mt-0.5">Soil pH</p>
                          <p className="font-bold text-gray-800 text-sm">{fmt(d.hp, 1)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <span className="material-icons text-blue-500 text-sm">water_drop</span>
                          <p className="text-xs text-gray-400 mt-0.5">Moisture</p>
                          <p className="font-bold text-gray-800 text-sm">{fmt(d.m, 1)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <span className="material-icons text-orange-500 text-sm">device_thermostat</span>
                          <p className="text-xs text-gray-400 mt-0.5">Soil Temp</p>
                          <p className="font-bold text-gray-800 text-sm">{fmt(d.t, 1)} °C</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setNpkField(field);
                          setActiveTab('npk');
                        }}
                        className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <span className="material-icons text-sm">analytics</span>
                        Run NPK Prediction for Field {field}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SENSORS TAB */}
          {activeTab === 'sensors' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Field Selection</label>
                  <select
                    value={sensField}
                    onChange={(e) => setSensField(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[140px]"
                  >
                    <option value="">All Fields</option>
                    <option>A</option>
                    <option>B</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(tsFields).map(([field, d]) => {
                  if (sensField && field !== sensField) return null;
                  const sensors = [
                    { label: 'Soil pH', val: d.hp, color: 'purple', icon: 'science' },
                    { label: 'Moisture', val: d.m, color: 'blue', icon: 'water_drop' },
                    { label: 'Soil Temp (°C)', val: d.t, color: 'orange', icon: 'device_thermostat' },
                    { label: 'EC (µS/cm)', val: d.c, color: 'yellow', icon: 'electric_bolt' },
                    { label: 'N (raw)', val: d.n, color: 'green', icon: 'grass' },
                    { label: 'P (raw)', val: d.p, color: 'teal', icon: 'agriculture' },
                    { label: 'K (raw)', val: d.k, color: 'indigo', icon: 'spa' },
                  ];
                  return sensors.map((s) => (
                    <div key={`${field}-${s.label}`} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-lg bg-${s.color}-100 flex items-center justify-center text-${s.color}-600`}>
                          <span className="material-icons text-base">{s.icon}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{s.label}</p>
                          <p className="text-xs text-gray-400">Field {field}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{fmt(s.val, 2)}</p>
                    </div>
                  ));
                })}
              </div>
            </div>
          )}

          {/* NPK TAB */}
          {activeTab === 'npk' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Select Field</label>
                  <select
                    value={npkField}
                    onChange={(e) => setNpkField(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[120px]"
                  >
                    <option>A</option>
                    <option>B</option>
                  </select>
                </div>
                <button
                  onClick={runNpkPrediction}
                  disabled={npkLoading}
                  className="bg-green-700 hover:bg-green-800 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition flex items-center gap-2"
                >
                  <span className="material-icons text-sm">calculate</span>
                  {npkLoading ? 'Running Prediction...' : 'Run Prediction'}
                </button>
              </div>

              {npkError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm flex items-center gap-2">
                  <span className="material-icons">error</span>
                  <span>{npkError}</span>
                </div>
              )}

              {npkResult && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm text-center border-t-4 border-green-500">
                      <div className="text-4xl mb-2">🌿</div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Nitrogen (N)</p>
                      <p className="text-4xl font-bold text-green-700">{npkResult.prediction.N.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-1">kg/ha</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm text-center border-t-4 border-blue-500">
                      <div className="text-4xl mb-2">💧</div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Phosphorus (P)</p>
                      <p className="text-4xl font-bold text-blue-700">{npkResult.prediction.P.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-1">kg/ha</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm text-center border-t-4 border-yellow-500">
                      <div className="text-4xl mb-2">🌾</div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Potassium (K)</p>
                      <p className="text-4xl font-bold text-yellow-700">{npkResult.prediction.K.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-1">kg/ha</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Model Input Features for Inference</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(npkResult.input_features || {}).map(([k, v]) => (
                        <div key={k} className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-xs text-gray-400">{k}</p>
                          <p className="font-semibold text-gray-800 text-sm">{typeof v === 'number' ? v.toFixed(3) : v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SATELLITE TAB */}
          {activeTab === 'satellite' && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">GEE Satellite Spectral Indices</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(geeFields).map(([field, d]) => {
                  const keys = ['NDVI', 'EVI', 'ARI', 'CAI', 'CIRE', 'DWSI', 'GCVI', 'MCARI', 'SIPI'];
                  return keys.map((k) => (
                    <div key={`${field}-${k}`} className="bg-white p-4 rounded-2xl shadow-sm border-t-2 border-green-500">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-green-700">{k}</span>
                        <span className="text-xs text-gray-400">Field {field}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{fmt(d[k], 4)}</p>
                    </div>
                  ));
                })}
              </div>

              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mt-4">NASA LaRC Atmospheric Readings</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(nasaFields).map(([field, d]) => (
                  <React.Fragment key={field}>
                    <div className="bg-white p-5 rounded-2xl shadow-sm text-center">
                      <span className="material-icons text-orange-500 text-3xl">thermostat</span>
                      <p className="text-xs text-gray-400 mt-1">Air Temp (T2M)</p>
                      <p className="text-2xl font-bold text-orange-700">{fmt(d.T2M, 1)} °C</p>
                      <p className="text-xs text-gray-400 mt-1">Field {field}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm text-center">
                      <span className="material-icons text-blue-500 text-3xl">water_drop</span>
                      <p className="text-xs text-gray-400 mt-1">Humidity (RH2M)</p>
                      <p className="text-2xl font-bold text-blue-700">{fmt(d.RH2M, 1)} %</p>
                      <p className="text-xs text-gray-400 mt-1">Field {field}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm text-center">
                      <span className="material-icons text-purple-500 text-3xl">compress</span>
                      <p className="text-xs text-gray-400 mt-1">Pressure (PS)</p>
                      <p className="text-2xl font-bold text-purple-700">{fmt(d.PS, 2)} kPa</p>
                      <p className="text-xs text-gray-400 mt-1">Field {field}</p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Field</label>
                  <select
                    value={histField}
                    onChange={(e) => setHistField(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[120px]"
                  >
                    <option>A</option>
                    <option>B</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Source</label>
                  <select
                    value={histSource}
                    onChange={(e) => setHistSource(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[140px]"
                  >
                    <option value="thingspeak">ThingSpeak</option>
                    <option value="nasa">NASA LaRC</option>
                    <option value="gee">GEE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Timeframe</label>
                  <select
                    value={histDays}
                    onChange={(e) => setHistDays(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="7">Past 7 days</option>
                    <option value="14">Past 14 days</option>
                    <option value="30">Past 30 days</option>
                    <option value="60">Past 60 days</option>
                  </select>
                </div>
                <button
                  onClick={fetchHistory}
                  disabled={histLoading}
                  className="bg-green-700 hover:bg-green-800 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition flex items-center gap-2"
                >
                  <span className="material-icons text-sm">search</span>
                  {histLoading ? 'Fetching...' : 'Fetch'}
                </button>
                <button
                  onClick={exportCSV}
                  className="border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <span className="material-icons text-sm">download</span>
                  Export
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Historical Records ({historyRecords.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        {historyRecords.length > 0 ? (
                          ['field', 'timestamp', ...Object.keys(historyRecords[0]).filter((k) => !['_id', '__v', 'field', 'timestamp'].includes(k))].map((c) => (
                            <th key={c} className="text-left px-5 py-3">{c}</th>
                          ))
                        ) : (
                          <th className="text-left px-5 py-3">Records</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {historyRecords.length > 0 ? (
                        historyRecords.map((r, i) => {
                          const cols = ['field', 'timestamp', ...Object.keys(r).filter((k) => !['_id', '__v', 'field', 'timestamp'].includes(k))];
                          return (
                            <tr key={i} className="border-t border-gray-50 hover:bg-green-50/50 transition">
                              {cols.map((c) => (
                                <td key={c} className="px-5 py-3 text-sm">
                                  {c === 'timestamp' ? fmtDate(r[c]) : typeof r[c] === 'number' ? r[c].toFixed(3) : r[c] ?? '—'}
                                </td>
                              ))}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="20" className="text-center py-10 text-gray-400">
                            Select field and click "Fetch"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
