import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Flame, Activity, ArrowRight, RefreshCw, Filter } from 'lucide-react';
import { api, Incident } from '../../services/api';

export const Incidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const data = await api.getIncidents();
      setIncidents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filtered = incidents.filter(i => {
    if (filter === 'ALL') return true;
    return i.status === filter;
  });

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white">Emergency Incidents</h2>
          <p className="text-xs text-slate-400">All detection events and dispatch history</p>
        </div>
        <button
          onClick={fetchIncidents}
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        {['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-xl transition ${
              filter === status
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No {filter !== 'ALL' ? filter.toLowerCase() : ''} incidents found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inc) => (
            <Link
              key={inc.incident_id}
              to={`/incidents/${inc.incident_id}`}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition block space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    inc.incident_type === 'ROAD_ACCIDENT'
                      ? 'bg-red-500/10 text-red-400'
                      : inc.incident_type === 'FIRE_ACCIDENT'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {inc.incident_type === 'FIRE_ACCIDENT' ? <Flame className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">
                      {inc.incident_type.replace('_', ' ')}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      {inc.incident_id}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  inc.status === 'ACTIVE'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {inc.status}
                </span>
              </div>

              {inc.summary && (
                <p className="text-xs text-slate-300 line-clamp-2 bg-slate-950/60 p-2 rounded-lg font-mono">
                  {inc.summary}
                </p>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                <span>{new Date(inc.created_at).toLocaleString()}</span>
                <span className="text-red-400 flex items-center gap-1 font-bold">
                  Inspect Details <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
