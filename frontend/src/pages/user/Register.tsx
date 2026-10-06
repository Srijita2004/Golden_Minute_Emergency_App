import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, Shield, User, Building2, Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('type') === 'hospital' ? 'hospital' : 'user';
  const [regRole, setRegRole] = useState<'user' | 'hospital'>(initialTab);

  // Common / Personal fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Hospital fields
  const [orgName, setOrgName] = useState('');
  const [operatorName, setOperatorName] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, register, registerHospital } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect
  useEffect(() => {
    if (user) {
      const isHospitalOrAdmin = user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'HOSPITAL';
      if (isHospitalOrAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');

      if (regRole === 'user') {
        await register({
          name,
          email,
          password,
          confirm_password: confirmPassword
        });
        setSuccessMsg('Personal account created successfully! Entering dashboard...');
        setTimeout(() => navigate('/'), 800);
      } else {
        await registerHospital({
          organization_name: orgName,
          operator_name: operatorName,
          email,
          password,
          confirm_password: confirmPassword
        });
        setSuccessMsg('Hospital Emergency Operations account registered! Entering Hospital Command Center...');
        setTimeout(() => navigate('/admin'), 800);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
        
        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              setRegRole('user');
              setError('');
              setSuccessMsg('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              regRole === 'user'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRegRole('hospital');
              setError('');
              setSuccessMsg('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              regRole === 'hospital'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Hospital / Center</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className={`inline-flex p-3 rounded-2xl mb-2 ${
            regRole === 'user'
              ? 'bg-red-600/10 border border-red-500/20 text-red-500'
              : 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400'
          }`}>
            {regRole === 'user' ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <Shield className="w-8 h-8" />
            )}
          </div>
          <h2 className="text-2xl font-black text-white">
            {regRole === 'user' ? 'Create Personal Account' : 'Register Emergency Center'}
          </h2>
          <p className="text-xs text-slate-400">
            {regRole === 'user'
              ? 'Join Golden Minute for personal crash, fall, and peripheral detection'
              : 'Register an authorized hospital facility for live incident triage'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {regRole === 'user' ? (
            /* Personal Account Fields */
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            /* Hospital Account Fields */
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hospital / Organization Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Metropolitan Trauma Care Hospital"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operator / Medical Director Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Dr. Angela Vance"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {regRole === 'user' ? 'Email Address' : 'Official Emergency / Dispatch Email'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={regRole === 'user' ? 'john.doe@example.com' : 'dispatch@hospital.org'}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password (min 8 chars)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          {regRole === 'hospital' && (
            <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 leading-relaxed">
              <span className="font-bold">Privilege Notice:</span> Hospital accounts receive administrative privileges for all-user live triage, incident status workflow, and emergency snapshot inspection.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 ${
              regRole === 'user'
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {loading
              ? 'Creating Account...'
              : regRole === 'user'
              ? 'Complete Personal Registration'
              : 'Register Hospital Facility'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800/80 text-center space-y-2">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link
              to={regRole === 'user' ? '/login?type=personal' : '/login?type=hospital'}
              className={`font-bold hover:underline ${
                regRole === 'user' ? 'text-red-400' : 'text-indigo-400'
              }`}
            >
              Sign In
            </Link>
          </p>

          <div>
            <button
              type="button"
              onClick={() => {
                setRegRole(regRole === 'user' ? 'hospital' : 'user');
                setError('');
                setSuccessMsg('');
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition underline underline-offset-2"
            >
              {regRole === 'user'
                ? 'Switch to Hospital / Emergency Center Registration'
                : 'Switch to Personal User Registration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
