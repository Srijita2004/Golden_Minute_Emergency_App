import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ShieldAlert, Cpu, LogOut, User as UserIcon, Settings, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to={(user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'HOSPITAL') ? "/admin" : "/"} className="flex items-center gap-2.5 group">
          <div className="p-2 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl shadow-lg shadow-red-500/20 group-hover:scale-105 transition">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-black text-base tracking-wider bg-gradient-to-r from-white via-slate-200 to-red-400 bg-clip-text text-transparent">
              GOLDEN MINUTE
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-mono tracking-widest text-slate-400 ml-2 border border-slate-700/60 px-1.5 py-0.5 rounded">
              {(user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'HOSPITAL') ? 'HOSPITAL MONITORING' : 'AI Emergency Response'}
            </span>
          </div>
        </Link>

        {/* Right Nav */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded border hidden sm:inline-block ${
              (user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'HOSPITAL')
                ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 font-bold'
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {(user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'HOSPITAL') ? `ROLE: ${user.role.toUpperCase()}` : 'USER'}
            </span>
          )}

          {/* Mock Mode Pill */}
          <Link
            to="/mock-studio"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mock Studio</span>
          </Link>

          {user ? (
            <>
              {(user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'HOSPITAL') && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Monitoring Feed
                </Link>
              )}

              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono text-slate-300">{user.email || user.user_id}</span>
              </div>

              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
