import React, { useState, useEffect } from 'react';
import { UserProfile, AppSettings, Astronaute, Session, Report, Grade, Promotion, Score, AuditLog } from './types';
import { api } from './lib/api';
import { getSessionProfile, getSessionToken, saveSession, clearSession } from './lib/session';
import LoginScreen from './components/LoginScreen';
import TerrainMode from './modes/TerrainMode';
import CommandMode from './modes/CommandMode';
import CelebrationOverlay from './components/CelebrationOverlay';
import { RefreshCw, Sliders, LogOut } from 'lucide-react';
import { onSnapshot, collection, doc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { seedFirestoreIfEmpty } from './lib/firebase-seeder';
import {
  useRealtimeUsers,
  useRealtimeAstronautes,
  useRealtimeSessions,
  useRealtimeReports,
  useRealtimeGrades,
  useRealtimePromotions,
  useRealtimeScores,
  useRealtimeAppSettings,
  useRealtimeAuditLogs
} from './hooks/useRealtimeData';

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

  const { users: liveProfiles, loading: usersLoading } = useRealtimeUsers();
  const { appSettings: liveSettings, loading: settingsLoading } = useRealtimeAppSettings();
  const { astronautes: liveAstronautes, loading: astrosLoading } = useRealtimeAstronautes();
  const { sessions: liveSessions, loading: sessionsLoading } = useRealtimeSessions();
  const { reports: liveReports, loading: reportsLoading } = useRealtimeReports();
  const { grades: liveGrades, loading: gradesLoading } = useRealtimeGrades();
  const { promotions: livePromotions, loading: promotionsLoading } = useRealtimePromotions();
  const { scores: liveScores, loading: scoresLoading } = useRealtimeScores();
  const { auditLogs: liveAuditLogs, loading: logsLoading } = useRealtimeAuditLogs();

  const isAnyCollectionLoading = usersLoading || settingsLoading || astrosLoading || sessionsLoading || reportsLoading || gradesLoading || promotionsLoading || scoresLoading || logsLoading;

  // Synchronize realtime live changes to local state
  useEffect(() => {
    if (!usersLoading) setProfiles(liveProfiles);
  }, [liveProfiles, usersLoading]);

  useEffect(() => {
    if (!settingsLoading) setAppSettings(liveSettings);
  }, [liveSettings, settingsLoading]);

  useEffect(() => {
    if (!astrosLoading) setAstronautes(liveAstronautes);
  }, [liveAstronautes, astrosLoading]);

  useEffect(() => {
    if (!sessionsLoading) setSessions(liveSessions);
  }, [liveSessions, sessionsLoading]);

  useEffect(() => {
    if (!reportsLoading) setReports(liveReports);
  }, [liveReports, reportsLoading]);

  useEffect(() => {
    if (!gradesLoading) setGrades(liveGrades);
  }, [liveGrades, gradesLoading]);

  useEffect(() => {
    if (!promotionsLoading) setPromotions(livePromotions);
  }, [livePromotions, promotionsLoading]);

  useEffect(() => {
    if (!scoresLoading) setScores(liveScores);
  }, [liveScores, scoresLoading]);

  useEffect(() => {
    if (!logsLoading) setAuditLogs(liveAuditLogs);
  }, [liveAuditLogs, logsLoading]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [activeMode, setActiveMode] = useState<'terrain' | 'command'>('terrain');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor online status to notify users about Firebase sync stability
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast("Connexion Internet rétablie. Synchronisation de la base de données Firebase active.", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast("Connexion Internet perdue. Vous travaillez actuellement en mode hors-ligne.", "danger");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

      // Auto seed empty Firebase Firestore database (integrity safety check)
      try {
        await seedFirestoreIfEmpty();
      } catch (err) {
        console.warn("La vérification de peuplement de la base de données Firestore a levé une exception:", err);
      }

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

  // Real-time synchronization is handled perfectly via separate custom hooks

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

  // Gracious French loading state using custom skeleton loaders
  if (isAnyCollectionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100 p-6 font-sans">
        <header className="bg-slate-900 border-b border-slate-800 shadow px-6 py-4 animate-pulse rounded-xl">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-800 rounded"></div>
              <div className="h-6 w-64 bg-slate-800 rounded"></div>
            </div>
            <div className="h-10 w-24 bg-slate-800 rounded-lg"></div>
          </div>
        </header>

        <main className="max-w-7xl w-full mx-auto mt-8 flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 animate-pulse">
              <div className="h-5 w-1/3 bg-slate-800 rounded"></div>
              <div className="h-4 w-full bg-slate-800 rounded"></div>
              <div className="h-32 bg-slate-800 rounded-lg"></div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 animate-pulse">
              <div className="h-5 w-1/4 bg-slate-800 rounded"></div>
              <div className="grid grid-cols-4 gap-4">
                <div className="h-10 bg-slate-800 rounded"></div>
                <div className="h-10 bg-slate-800 rounded"></div>
                <div className="h-10 bg-slate-800 rounded"></div>
                <div className="h-10 bg-slate-800 rounded"></div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 animate-pulse">
              <div className="h-5 w-1/2 bg-slate-800 rounded"></div>
              <div className="h-20 bg-slate-800 rounded-lg"></div>
              <div className="h-20 bg-slate-800 rounded-lg"></div>
            </div>
          </div>
        </main>

        <footer className="max-w-7xl w-full mx-auto mt-8 h-10 bg-slate-900 border border-slate-800 rounded-lg animate-pulse"></footer>
      </div>
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
          isOnline={isOnline}
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
          isOnline={isOnline}
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
