import React, { useState, useEffect } from 'react';
import { apiFetch, fmt, fmtDate } from '../api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminPortal({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('--');

  // Filters for "All Farmers" table
  const [filterFarmer, setFilterFarmer] = useState('');
  const [filterField, setFilterField] = useState('');
  const [filterSource, setFilterSource] = useState('thingspeak');

  // Sensors filters
  const [sdFarmer, setSdFarmer] = useState('');
  const [sdField, setSdField] = useState('');

  // NPK Prediction
  const [npkFarmer, setNpkFarmer] = useState('Jaspreet');
  const [npkField, setNpkField] = useState('A');
  const [npkLoading, setNpkLoading] = useState(false);
  const [npkResult, setNpkResult] = useState(null);
  const [npkError, setNpkError] = useState('');

  // History Tab
  const [histFarmer, setHistFarmer] = useState('Jaspreet');
  const [histField, setHistField] = useState('A');
  const [histSource, setHistSource] = useState('thingspeak');
  const [histDays, setHistDays] = useState('30');
  const [historyRecords, setHistoryRecords] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // Satellite Tab
  const [geeFarmer, setGeeFarmer] = useState('');

  // Overview bar chart data
  const [npkOverview, setNpkOverview] = useState({ labels: [], datasets: [] });

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/get_all_data');
      setAllData(data);
      setLastUpdate(new Date().toLocaleTimeString('en-IN'));
      setLoading(false);
      loadNpkOverview();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const loadNpkOverview = async () => {
    const farmers = ['Jaspreet', 'Netar', 'Muktiyar'];
    const fields = [['A', 'B'], ['A'], ['A']];
    const labels = [];
    const nVals = [];
    const pVals = [];
    const kVals = [];

    for (let i = 0; i < farmers.length; i++) {
      for (const f of fields[i]) {
        try {
          const res = await apiFetch(`/predict?farmer=${farmers[i]}&field=${f}`);
          if (res.prediction) {
            labels.push(`${farmers[i]}-${f}`);
            nVals.push(+res.prediction.N.toFixed(1));
            pVals.push(+res.prediction.P.toFixed(1));
            kVals.push(+res.prediction.K.toFixed(1));
          }
        } catch (e) {}
      }
    }

    setNpkOverview({
      labels,
      datasets: [
        { label: 'N (Nitrogen)', data: nVals, backgroundColor: 'rgba(5, 150, 105, 0.7)', borderRadius: 6 },
        { label: 'P (Phosphorus)', data: pVals, backgroundColor: 'rgba(59, 130, 246, 0.7)', borderRadius: 6 },
        { label: 'K (Potassium)', data: kVals, backgroundColor: 'rgba(234, 179, 8, 0.7)', borderRadius: 6 },
      ],
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const runNpkPrediction = async () => {
    setNpkLoading(true);
    setNpkError('');
    setNpkResult(null);
    try {
      const res = await apiFetch(`/predict?farmer=${npkFarmer}&field=${npkField}`);
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
      const farmersToQuery = histFarmer ? [histFarmer] : ['Jaspreet', 'Netar', 'Muktiyar'];
      const fieldsToQuery = histField ? [histField] : ['A', 'B'];
      let records = [];

      for (const f of farmersToQuery) {
        for (const fl of fieldsToQuery) {
          try {
            const res = await apiFetch(`/get_history?farmer=${encodeURIComponent(f)}&field=${encodeURIComponent(fl)}&days=${histDays}`);
            const srcData = res?.data?.[histSource] || [];
            if (Array.isArray(srcData)) {
              srcData.forEach((item) => {
                records.push({ ...item, farmer: item.farmer || f, field: item.field || fl });
              });
            }
          } catch (e) {}
        }
      }

      records.sort((a, b) => new Date(b.timestamp?.$date || b.timestamp || 0) - new Date(a.timestamp?.$date || a.timestamp || 0));
      setHistoryRecords(records);
    } catch (e) {
      console.error(e);
    } finally {
      setHistLoading(false);
    }
  };

  const exportCSV = (dataList, filename) => {
    if (!dataList || !dataList.length) return alert('No data to export.');
    const cols = Object.keys(dataList[0]).filter((k) => k !== '_id');
    let csv = cols.join(',') + '\n';
    dataList.forEach((row) => {
      csv += cols.map((col) => {
        let v = row[col];
        if (v && typeof v === 'object' && v.$date) v = new Date(v.$date).toISOString();
        return `"${String(v ?? '').replace(/"/g, '""')}"`;
      }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-green-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col flex-shrink-0 z-20">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-3xl font-bold hindi text-green-800">आहार</h1>
          <span className="text-xs text-gray-400 tracking-widest uppercase font-medium mt-1 block">Admin React Portal</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
            { id: 'all-farmers', label: 'All Farmers', icon: 'groups' },
            { id: 'sensor-data', label: 'Sensor Data', icon: 'sensors' },
            { id: 'npk-reports', label: 'NPK Reports', icon: 'analytics' },
            { id: 'history', label: 'Data History', icon: 'history' },
            { id: 'satellite', label: 'Satellite / GEE', icon: 'satellite_alt' },
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
            <div className="w-9 h-9 bg-green-700 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">A</div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-400">admin</p>
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
            <p className="text-xs text-gray-400">Live data fed from Render Backend (scaled-dv.onrender.com)</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-700 font-medium">Render Connected</span>
            </div>
            <button onClick={loadData} className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-700 transition">
              <span className="material-icons text-lg">refresh</span>
            </button>
            <span className="text-xs text-gray-400">Updated: {lastUpdate}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Farmers</p>
                  <p className="text-3xl font-bold text-gray-800">3</p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">Jaspreet, Netar, Muktiyar</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Monitored Fields</p>
                  <p className="text-3xl font-bold text-gray-800">4 Active</p>
                  <p className="text-xs text-blue-600 mt-1">ThingSpeak Channel Feeds</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-yellow-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Data Sources</p>
                  <p className="text-3xl font-bold text-gray-800">3 Sources</p>
                  <p className="text-xs text-yellow-600 mt-1">ThingSpeak · NASA · GEE</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Backend Engine</p>
                  <p className="text-3xl font-bold text-gray-800">Live (OK)</p>
                  <p className="text-xs text-purple-600 mt-1">Render Gunicorn Cluster</p>
                </div>
              </div>

              {/* Cards Grid */}
              <h3 className="text-base font-semibold text-gray-700">Real-Time Field Summary</h3>
              {loading ? (
                <div className="bg-white p-12 rounded-2xl shadow-sm text-center text-gray-400">Loading live data from Render...</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {allData && allData['ThingSpeak Data'] && Object.entries(allData['ThingSpeak Data']).map(([farmer, fields]) =>
                    Object.entries(fields).map(([field, d]) => {
                      const nasa = allData['NASA LaRC Data']?.[farmer]?.[field] || {};
                      return (
                        <div key={`${farmer}-${field}`} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-bold text-gray-800 text-lg">{farmer}</h4>
                              <p className="text-xs text-gray-400">Field {field}</p>
                            </div>
                            <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs">Field {field}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-gray-400">Soil pH</p>
                              <p className="font-bold text-gray-800 text-sm">{fmt(d.hp, 1)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-gray-400">Soil Temp</p>
                              <p className="font-bold text-gray-800 text-sm">{fmt(d.t, 1)} °C</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-gray-400">EC</p>
                              <p className="font-bold text-gray-800 text-sm">{fmt(d.c, 2)} µS</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-gray-400">Air Temp (NASA)</p>
                              <p className="font-bold text-gray-800 text-sm">{fmt(nasa.T2M, 1)} °C</p>
                            </div>
                          </div>
                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                            <span className="text-gray-400">{fmtDate(d.timestamp)}</span>
                            <button
                              onClick={() => {
                                setNpkFarmer(farmer);
                                setNpkField(field);
                                setActiveTab('npk-reports');
                              }}
                              className="text-green-600 font-semibold hover:underline"
                            >
                              Predict NPK →
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="text-base font-semibold text-gray-700 mb-4">Live NPK Prediction Overview Across Farms</h3>
                {npkOverview.labels.length > 0 ? (
                  <Bar data={npkOverview} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
                ) : (
                  <div className="py-12 text-center text-gray-400">Fetching chart predictions...</div>
                )}
              </div>
            </div>
          )}

          {/* ALL FARMERS TAB */}
          {activeTab === 'all-farmers' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Farmer</label>
                  <select
                    value={filterFarmer}
                    onChange={(e) => setFilterFarmer(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[150px]"
                  >
                    <option value="">All Farmers</option>
                    <option>Jaspreet</option>
                    <option>Netar</option>
                    <option>Muktiyar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Field</label>
                  <select
                    value={filterField}
                    onChange={(e) => setFilterField(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[120px]"
                  >
                    <option value="">All Fields</option>
                    <option>A</option>
                    <option>B</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Data Source</label>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[160px]"
                  >
                    <option value="thingspeak">ThingSpeak (Sensors)</option>
                    <option value="nasa">NASA LaRC</option>
                    <option value="gee">GEE Satellite</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Records View</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="text-left px-5 py-3">Farmer</th>
                        <th className="text-left px-5 py-3">Field</th>
                        {filterSource === 'thingspeak' && (
                          <>
                            <th className="text-left px-5 py-3">Soil pH</th>
                            <th className="text-left px-5 py-3">Moisture</th>
                            <th className="text-left px-5 py-3">Soil Temp (°C)</th>
                            <th className="text-left px-5 py-3">EC (µS/cm)</th>
                            <th className="text-left px-5 py-3">N (raw)</th>
                            <th className="text-left px-5 py-3">P (raw)</th>
                            <th className="text-left px-5 py-3">K (raw)</th>
                          </>
                        )}
                        {filterSource === 'nasa' && (
                          <>
                            <th className="text-left px-5 py-3">Air Temp (T2M)</th>
                            <th className="text-left px-5 py-3">Humidity (RH2M)</th>
                            <th className="text-left px-5 py-3">Pressure (PS)</th>
                            <th className="text-left px-5 py-3">Date</th>
                          </>
                        )}
                        {filterSource === 'gee' && (
                          <>
                            <th className="text-left px-5 py-3">NDVI</th>
                            <th className="text-left px-5 py-3">EVI</th>
                            <th className="text-left px-5 py-3">ARI</th>
                            <th className="text-left px-5 py-3">CAI</th>
                            <th className="text-left px-5 py-3">CIRE</th>
                            <th className="text-left px-5 py-3">DWSI</th>
                          </>
                        )}
                        <th className="text-left px-5 py-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allData && (() => {
                        const sourceKey = filterSource === 'thingspeak' ? 'ThingSpeak Data' : filterSource === 'nasa' ? 'NASA LaRC Data' : 'GEE Data';
                        const dataset = allData[sourceKey] || {};
                        const rows = [];
                        Object.entries(dataset).forEach(([farmer, fields]) => {
                          if (filterFarmer && farmer !== filterFarmer) return;
                          Object.entries(fields).forEach(([field, d]) => {
                            if (filterField && field !== filterField) return;
                            rows.push({ farmer, field, ...d });
                          });
                        });

                        if (!rows.length) {
                          return <tr><td colSpan="10" className="text-center py-8 text-gray-400">No matching records</td></tr>;
                        }

                        return rows.map((r, i) => (
                          <tr key={i} className="border-t border-gray-50 hover:bg-green-50/50 transition">
                            <td className="px-5 py-3 font-semibold text-gray-800">{r.farmer}</td>
                            <td className="px-5 py-3"><span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-bold">Field {r.field}</span></td>
                            {filterSource === 'thingspeak' && (
                              <>
                                <td className="px-5 py-3">{fmt(r.hp, 2)}</td>
                                <td className="px-5 py-3">{fmt(r.m, 2)}</td>
                                <td className="px-5 py-3">{fmt(r.t, 1)}</td>
                                <td className="px-5 py-3">{fmt(r.c, 2)}</td>
                                <td className="px-5 py-3">{fmt(r.n, 1)}</td>
                                <td className="px-5 py-3">{fmt(r.p, 1)}</td>
                                <td className="px-5 py-3">{fmt(r.k, 1)}</td>
                              </>
                            )}
                            {filterSource === 'nasa' && (
                              <>
                                <td className="px-5 py-3 font-semibold text-orange-600">{fmt(r.T2M, 1)} °C</td>
                                <td className="px-5 py-3 font-semibold text-blue-600">{fmt(r.RH2M, 1)} %</td>
                                <td className="px-5 py-3 font-semibold text-purple-600">{fmt(r.PS, 2)} kPa</td>
                                <td className="px-5 py-3 text-gray-500">{r.date || '—'}</td>
                              </>
                            )}
                            {filterSource === 'gee' && (
                              <>
                                <td className="px-5 py-3 font-bold text-green-700">{fmt(r.NDVI, 4)}</td>
                                <td className="px-5 py-3 text-emerald-700">{fmt(r.EVI, 4)}</td>
                                <td className="px-5 py-3 text-red-700">{fmt(r.ARI, 4)}</td>
                                <td className="px-5 py-3 text-orange-700">{fmt(r.CAI, 4)}</td>
                                <td className="px-5 py-3 text-purple-700">{fmt(r.CIRE, 4)}</td>
                                <td className="px-5 py-3 text-blue-700">{fmt(r.DWSI, 4)}</td>
                              </>
                            )}
                            <td className="px-5 py-3 text-xs text-gray-400">{fmtDate(r.timestamp)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SENSOR DATA TAB */}
          {activeTab === 'sensor-data' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Farmer</label>
                  <select
                    value={sdFarmer}
                    onChange={(e) => setSdFarmer(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[150px]"
                  >
                    <option value="">All Farmers</option>
                    <option>Jaspreet</option>
                    <option>Netar</option>
                    <option>Muktiyar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Field</label>
                  <select
                    value={sdField}
                    onChange={(e) => setSdField(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[120px]"
                  >
                    <option value="">All Fields</option>
                    <option>A</option>
                    <option>B</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allData && allData['ThingSpeak Data'] && Object.entries(allData['ThingSpeak Data']).map(([farmer, fields]) => {
                  if (sdFarmer && farmer !== sdFarmer) return null;
                  return Object.entries(fields).map(([field, d]) => {
                    if (sdField && field !== sdField) return null;
                    const metrics = [
                      { label: 'Soil pH', val: d.hp, color: 'purple', icon: 'science' },
                      { label: 'Moisture', val: d.m, color: 'blue', icon: 'water_drop' },
                      { label: 'Soil Temp (°C)', val: d.t, color: 'orange', icon: 'device_thermostat' },
                      { label: 'EC (µS/cm)', val: d.c, color: 'yellow', icon: 'electric_bolt' },
                      { label: 'Nutrient N', val: d.n, color: 'green', icon: 'grass' },
                      { label: 'Nutrient P', val: d.p, color: 'teal', icon: 'agriculture' },
                      { label: 'Nutrient K', val: d.k, color: 'indigo', icon: 'spa' },
                    ];
                    return metrics.map((m) => (
                      <div key={`${farmer}-${field}-${m.label}`} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-8 h-8 rounded-lg bg-${m.color}-100 flex items-center justify-center text-${m.color}-600`}>
                            <span className="material-icons text-base">{m.icon}</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{m.label}</p>
                            <p className="text-xs text-gray-400">{farmer} / Field {field}</p>
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{fmt(m.val, 1)}</p>
                      </div>
                    ));
                  });
                })}
              </div>
            </div>
          )}

          {/* NPK REPORTS TAB */}
          {activeTab === 'npk-reports' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Farmer</label>
                  <select
                    value={npkFarmer}
                    onChange={(e) => setNpkFarmer(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[150px]"
                  >
                    <option>Jaspreet</option>
                    <option>Netar</option>
                    <option>Muktiyar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Field</label>
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
                  {npkLoading ? 'Calculating...' : 'Run Prediction'}
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
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Nitrogen (N)</p>
                      <p className="text-4xl font-bold text-green-700">{npkResult.prediction.N.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-1">kg/ha</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm text-center border-t-4 border-blue-500">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Phosphorus (P)</p>
                      <p className="text-4xl font-bold text-blue-700">{npkResult.prediction.P.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-1">kg/ha</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm text-center border-t-4 border-yellow-500">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Potassium (K)</p>
                      <p className="text-4xl font-bold text-yellow-700">{npkResult.prediction.K.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-1">kg/ha</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Model Features Used</h3>
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

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Farmer</label>
                  <select
                    value={histFarmer}
                    onChange={(e) => setHistFarmer(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[140px]"
                  >
                    <option value="">All Farmers</option>
                    <option>Jaspreet</option>
                    <option>Netar</option>
                    <option>Muktiyar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Field</label>
                  <select
                    value={histField}
                    onChange={(e) => setHistField(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[120px]"
                  >
                    <option value="">All Fields</option>
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
                  {histLoading ? 'Fetching...' : 'Fetch History'}
                </button>
                <button
                  onClick={() => exportCSV(historyRecords, `history_${histFarmer || 'all'}`)}
                  className="border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <span className="material-icons text-sm">download</span>
                  Export CSV
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
                          ['farmer', 'field', 'timestamp', ...Object.keys(historyRecords[0]).filter((k) => !['_id', '__v', 'farmer', 'field', 'timestamp'].includes(k))].map((c) => (
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
                          const cols = ['farmer', 'field', 'timestamp', ...Object.keys(r).filter((k) => !['_id', '__v', 'farmer', 'field', 'timestamp'].includes(k))];
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
                            Select filters and click "Fetch History"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SATELLITE TAB */}
          {activeTab === 'satellite' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Filter Farmer</label>
                  <select
                    value={geeFarmer}
                    onChange={(e) => setGeeFarmer(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[150px]"
                  >
                    <option value="">All Farmers</option>
                    <option>Jaspreet</option>
                    <option>Netar</option>
                    <option>Muktiyar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {allData && allData['GEE Data'] && Object.entries(allData['GEE Data']).map(([farmer, fields]) => {
                  if (geeFarmer && farmer !== geeFarmer) return null;
                  return Object.entries(fields).map(([field, d]) => {
                    const keys = ['NDVI', 'EVI', 'ARI', 'CAI', 'CIRE', 'DWSI', 'GCVI', 'MCARI', 'SIPI'];
                    return keys.map((k) => (
                      <div key={`${farmer}-${field}-${k}`} className="bg-white p-4 rounded-2xl shadow-sm border-t-2 border-green-500">
                        <p className="text-xs text-gray-400">{farmer} / {field}</p>
                        <p className="text-sm font-semibold text-gray-700">{k}</p>
                        <p className="text-2xl font-bold text-green-700 mt-1">{fmt(d[k], 4)}</p>
                      </div>
                    ));
                  });
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
