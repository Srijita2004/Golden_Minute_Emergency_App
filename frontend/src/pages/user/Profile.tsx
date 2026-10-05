import React from 'react';
import { User, Mail, Shield, Calendar, LogOut, Cpu, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-white">Personal Account</h2>
        <p className="text-xs text-slate-400">Account security, user identification, and settings</p>
      </div>

      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-red-600/20">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">{user.name}</h3>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
              {user.user_id}
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl">
            <span className="text-slate-400 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500" /> Email
            </span>
            <span className="text-slate-200 font-medium">{user.email}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl">
            <span className="text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" /> Account Role
            </span>
            <span className="text-slate-200 font-bold uppercase">{user.role}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl">
            <span className="text-slate-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" /> Registered Since
            </span>
            <span className="text-slate-200">{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full py-2.5 bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Log Out of Account
        </button>
      </div>
    </div>
  );
};
