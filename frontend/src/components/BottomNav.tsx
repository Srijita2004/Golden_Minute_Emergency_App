import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Camera, Activity, Smartphone, AlertTriangle, Cpu, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/camera-detail', label: 'Camera', icon: Camera },
    { to: '/wristband-detail', label: 'Wristband', icon: Activity },
    { to: '/phone-camera', label: 'Phone AI', icon: Smartphone },
    { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
    { to: '/devices', label: 'Devices', icon: Cpu },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 sm:px-6">
      <div className="max-w-md md:max-w-xl mx-auto flex items-center justify-between">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition text-[10px] font-medium ${
                isActive
                  ? 'text-red-500 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-5 h-5 mb-0.5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
