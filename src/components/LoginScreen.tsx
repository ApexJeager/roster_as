import React, { useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Shield, Award, UsersRound, Lock, ArrowLeft, RefreshCw, Delete } from 'lucide-react';

interface LoginScreenProps {
  allProfiles: UserProfile[];
  onLoginSuccess: (profile: UserProfile, token: string) => void;
}

export default function LoginScreen({ allProfiles, onLoginSuccess }: LoginScreenProps) {
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  // Helper to fetch icon corresponding to roles
  const getIconForRole = (role: string) => {
    switch (role) {
      case 'developer':
        return <Shield className="w-6 h-6 text-orange-500" />;
      case 'leader':
        return <Award className="w-6 h-6 text-yellow-500" />;
      case 'pilote':
        return <Users className="w-6 h-6 text-blue-500" />;
      case 'copilote':
        return <UsersRound className="w-6 h-6 text-teal-400" />;
      default:
        return <Users className="w-6 h-6 text-gray-500" />;
    }
  };

  const getRoleLabel = (profile: UserProfile) => {
    switch (profile.role) {
      case 'developer':
        return 'Ingénieur Ghost Systems';
      case 'leader':
        return 'Président ASBF';
      case 'pilote':
        return `Pilote — ${profile.assignment?.classe || 'Sans classe'}`;
      case 'copilote':
        return `Copilote — ${profile.assignment?.classe || 'Sans classe'}`;
      default:
        return 'Volontaire';
    }
  };

  const handleKeyPress = (num: string) => {
    if (isLoading) return;
    setError(null);
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        submitPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isLoading) return;
    setError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const submitPin = async (completedPin: string) => {
    if (!selectedProfile) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.login(selectedProfile.id, completedPin);
      setIsLoading(false);
      onLoginSuccess(res.profile, res.token);
    } catch (err: any) {
      setIsLoading(false);
      setPin('');
      setShake(true);
      setError(err?.message || 'Code incorrect, réessayez.');
      setTimeout(() => setShake(false), 500);
    }
  };

  const closePinPad = () => {
    setSelectedProfile(null);
    setPin('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-6">
      {/* Top Banner */}
      <div className="text-center pt-8 max-w-md mx-auto">
        <span className="text-xs tracking-widest text-orange-500 font-mono uppercase">GHOST SYSTEMS</span>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">RAPPORT ASTRONAUTES</h1>
        <p className="text-slate-400 mt-2 text-sm leading-relaxed">
          Saisie simplifiée, progression militaire des grades et scoring gamifié pour le ministère enfants ASBF (Haiti).
        </p>
      </div>

      {/* Profile Grid */}
      <div className="my-auto max-w-md w-full mx-auto space-y-5">
        <div className="text-center">
          <p className="text-slate-300 font-medium text-base">Sélectionnez votre profil de vol</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {allProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProfile(p);
                setPin('');
                setError(null);
              }}
              className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl transition duration-150 active:scale-[0.98] cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-750 flex items-center justify-center border border-slate-700">
                  {getIconForRole(p.role)}
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-white group-hover:text-amber-400 transition-colors">
                    {p.full_name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {getRoleLabel(p)}
                  </p>
                </div>
              </div>
              
              {p.assignment && (
                <span className={`text-[11px] font-bold px-2 py-1 rounded ml-2 ${
                  p.assignment.groupe === 'Vert' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  p.assignment.groupe === 'Rouge' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                  p.assignment.groupe === 'Jaune' ? 'bg-yellow-950 text-yellow-300 border border-yellow-800' :
                  'bg-sky-950 text-sky-300 border border-sky-800'
                }`}>
                  {p.assignment.groupe}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center pb-2 text-xs text-slate-500 font-mono">
        RÉSEAU ASBF • CLOUD PRIVÉ SECURE
      </div>

      {/* Fullscreen PIN Pad Overlay */}
      <AnimatePresence>
        {selectedProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-6 z-50 animate-duration-200"
          >
            {/* Header / Back action */}
            <div className="flex items-center justify-between">
              <button
                onClick={closePinPad}
                className="flex items-center gap-2 text-slate-450 hover:text-white px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Profils</span>
              </button>
              <div className="text-right">
                <span className="text-[10px] font-mono tracking-widest text-orange-500">ACCÈS SÉCURISÉ</span>
              </div>
            </div>

            {/* Profile Detail */}
            <div className="text-center space-y-3 my-auto max-w-sm mx-auto w-full">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto shadow-inner">
                {getIconForRole(selectedProfile.role)}
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-white">{selectedProfile.full_name}</h3>
                <p className="text-sm text-slate-400">{getRoleLabel(selectedProfile)}</p>
              </div>

              {/* PIN Code Dots Indicator */}
              <div className="py-6 flex flex-col items-center gap-4">
                <motion.div 
                  animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className="flex justify-center gap-5"
                >
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-100 ${
                        pin.length > index
                          ? 'bg-amber-400 border-amber-400 scale-110 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'border-slate-600 bg-transparent'
                      }`}
                    />
                  ))}
                </motion.div>

                {/* Error Banner */}
                <div className="h-6">
                  {error && (
                    <span className="text-red-400 text-sm font-semibold text-center select-none">
                      {error}
                    </span>
                  )}
                  {isLoading && (
                    <span className="text-slate-400 text-xs flex items-center justify-center gap-2 animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Verification...
                    </span>
                  )}
                </div>
              </div>

              {/* Grid numeric pad */}
              <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto select-none">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-mono text-2xl font-bold flex items-center justify-center active:scale-90 transition duration-100 cursor-pointer shadow-md"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Empty cell/cancel */}
                <button
                  onClick={closePinPad}
                  className="w-16 h-16 rounded-full text-sm text-slate-450 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  Annuler
                </button>

                {/* Zero */}
                <button
                  onClick={() => handleKeyPress('0')}
                  className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-mono text-2xl font-bold flex items-center justify-center active:scale-90 transition duration-100 cursor-pointer shadow-md"
                >
                  0
                </button>

                {/* Backspace */}
                <button
                  onClick={handleBackspace}
                  className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center active:scale-90 transition duration-100 cursor-pointer"
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Back to list info */}
            <div className="text-center text-[10px] text-slate-600 font-mono pb-2">
              CONTRÔLEUR D'ACCÈS DU MINISTÈRE ENFANT GHOST SYSTEMS
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
