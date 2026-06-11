import React, { useState, useEffect } from 'react';
import { UserProfile, AppSettings, Astronaute, Session, Report, Grade, Promotion, Score, AuditLog } from './types';
import { api } from './lib/api';
import { getSessionProfile, getSessionToken, saveSession, clearSession } from './lib/session';
import LoginScreen from './components/LoginScreen';
import TerrainMode from './modes/TerrainMode';
import CommandMode from './modes/CommandMode';
import CelebrationOverlay from './components/CelebrationOverlay';
import { RefreshCw, Sliders, LogOut } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allProfiles, setProfiles] = useState<UserProfile[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ summer_pause: false, correction_window_hours: 48 });
  const [astronautes, setAstronautes] = useState<Astronaute[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [activeMode, setActiveMode] = useState<'terrain' | 'command'>('terrain');

  // Celebration state
  const [celebration, setCelebration] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
    badgeText?: string;
  }>({ visible: false, title: '', subtitle: '' });

  // Custom toast notification element
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const triggerCelebration = (title: string, subtitle: string, badgeText: string) => {
    setCelebration({
      visible: true,
      title,
      subtitle,
      badgeText
    });
  };

  // Centralized live sync loader
  const handleRefreshFullSync = async () => {
    try {
      const [
        settingsPayload,
        astrosPayload,
        sessionsPayload,
        reportsPayload,
        gradesPayload,
        promsPayload,
        scoresPayload,
        logsPayload,
        profilesPayload
      ] = await Promise.all([
        api.getAppSettings(),
        api.getAstronautes(),
        api.getSessions(),
        api.getReports(),
        api.getGrades(),
        api.getPromotions(),
        api.getScores(),
        api.getAuditLogs().catch(() => []), // standard fail proof
        api.getProfiles().catch(() => [])
      ]);

      setAppSettings(settingsPayload);
      setAstronautes(astrosPayload);
      setSessions(sessionsPayload);
      setReports(reportsPayload);
      setGrades(gradesPayload);
      setPromotions(promsPayload);
      setScores(scoresPayload);
      setAuditLogs(logsPayload);
      setProfiles(profilesPayload);
    } catch (e: any) {
      showToast(e.message || "Erreur lors du rafraîchissement des pointages.", "danger");
    }
  };

  // Token bootloader
  useEffect(() => {
    const initSessionBoot = async () => {
      const token = getSessionToken();
      const cachedProfile = getSessionProfile();

      // Always load the profile list so the login page can be pre-rendered instantly
      try {
        const list = await api.getProfiles();
        setProfiles(list);
      } catch {}

      if (token && cachedProfile) {
        try {
          // Double verify session with backend
          const user = await api.getCurrentUser();
          setCurrentUser(user);
          
          // Setup active role mode
          if (user.role === 'developer' || user.role === 'leader') {
            setActiveMode('command');
          } else {
            setActiveMode('terrain');
          }
          
          // Pull down full list payload
          await handleRefreshFullSync();
        } catch (e) {
          // invalid cached token, discard
          clearSession();
          setCurrentUser(null);
        }
      }
      setIsCheckingToken(false);
      setIsLoaded(true);
    };

    initSessionBoot();
  }, []);

  // Post Login Success Router callback
  const handleLoginSuccess = async (profile: UserProfile, token: string) => {
    saveSession(profile, token);
    setCurrentUser(profile);
    
    // Choose active user mode
    if (profile.role === 'developer' || profile.role === 'leader') {
      setActiveMode('command');
    } else {
      setActiveMode('terrain');
    }
    
    // pull down payload
    setIsCheckingToken(true);
    await handleRefreshFullSync();
    setIsCheckingToken(false);
    showToast(`Connexion d'équipage autorisée ! Bienvenue ${profile.full_name}.`, 'success');
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    showToast("Session déconnectée de la base de données.", "info");
  };

  // While boot loading, render loading card
  if (isCheckingToken && !isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3.5 select-none text-slate-400">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs font-mono tracking-widest font-bold text-slate-500 uppercase">SYNCHRONISATION GHOST SYSTEMS...</span>
      </div>
    );
  }

  // Login Form Screen if no user profile is set
  if (!currentUser) {
    return (
      <LoginScreen
        allProfiles={allProfiles}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="relative font-sans antialiased min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Toast Alert Portal Box (Group C8) */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 max-w-sm w-full px-4 z-50">
          <div className={`p-4 rounded-xl border shadow-lg flex items-center justify-between text-xs leading-relaxed font-bold animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300' :
            toast.type === 'danger' ? 'bg-red-950/95 border-red-500/40 text-red-300' :
            'bg-slate-900 border-slate-750 text-slate-350'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Mode Transfer Render */}
      {activeMode === 'terrain' ? (
        <TerrainMode
          currentUser={currentUser}
          appSettings={appSettings}
          astronautes={astronautes}
          sessions={sessions}
          reports={reports}
          grades={grades}
          promotions={promotions}
          onRefresh={handleRefreshFullSync}
          onLogout={handleLogout}
          showToast={showToast}
          triggerCelebration={triggerCelebration}
          onSwitchMode={() => setActiveMode('command')}
        />
      ) : (
        <CommandMode
          currentUser={currentUser}
          allProfiles={allProfiles}
          appSettings={appSettings}
          astronautes={astronautes}
          sessions={sessions}
          reports={reports}
          grades={grades}
          promotions={promotions}
          scores={scores}
          auditLogs={auditLogs}
          onRefresh={handleRefreshFullSync}
          onLogout={handleLogout}
          showToast={showToast}
          triggerCelebration={triggerCelebration}
          onSwitchMode={() => setActiveMode('terrain')}
        />
      )}

      {/* Celebrate overlay portals */}
      <CelebrationOverlay
        isVisible={celebration.visible}
        onClose={() => setCelebration({ visible: false, title: '', subtitle: '' })}
        title={celebration.title}
        subtitle={celebration.subtitle}
        badgeText={celebration.badgeText}
      />
    </div>
  );
}
