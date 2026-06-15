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

  // Real-time synchronization
  useEffect(() => {
    if (!currentUser) return;

    // Attach real-time subscriptions across all synchronized collections!
    const unsubs = [
      onSnapshot(doc(db, 'app_settings', 'global'), (docSnap) => {
        if (docSnap.exists()) {
          setAppSettings(docSnap.data() as AppSettings);
        }
      }),
      onSnapshot(collection(db, 'profiles'), (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as UserProfile));
        setProfiles(list);
      }),
      onSnapshot(collection(db, 'astronautes'), (snap) => {
        const list: Astronaute[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Astronaute));
        setAstronautes(list);
      }),
      onSnapshot(collection(db, 'sessions'), (snap) => {
        const list: Session[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Session));
        setSessions(list);
      }),
      onSnapshot(collection(db, 'reports'), (snap) => {
        const list: Report[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Report));
        setReports(list);
      }),
      onSnapshot(collection(db, 'grades'), (snap) => {
        const list: Grade[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Grade));
        list.sort((a, b) => a.sort_order - b.sort_order);
        setGrades(list);
      }),
      onSnapshot(collection(db, 'promotions'), (snap) => {
        const list: Promotion[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Promotion));
        setPromotions(list);
      }),
      onSnapshot(collection(db, 'scores'), (snap) => {
        const list: Score[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Score));
        setScores(list);
      }),
      onSnapshot(collection(db, 'audit_logs'), (snap) => {
        const list: AuditLog[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as AuditLog));
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAuditLogs(list);
      })
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [currentUser]);

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
