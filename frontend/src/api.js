const API_BASE = 'https://scaled-dv.onrender.com';

export const USERS = {
  admin: { password: 'admin@2024', role: 'admin', name: 'Administrator', farmer: null },
  jaspreet: { password: 'jaspreet@123', role: 'farmer', name: 'Jaspreet Singh', farmer: 'Jaspreet' },
  netar: { password: 'netar@123', role: 'farmer', name: 'Netar Singh', farmer: 'Netar' },
  muktiyar: { password: 'muktiyar@123', role: 'farmer', name: 'Muktiyar Singh', farmer: 'Muktiyar' },
};

export async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return await res.json();
}

export function fmt(val, dec = 2) {
  if (val === undefined || val === null || val === 'N/A') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(dec);
}

export function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts.$date || ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
