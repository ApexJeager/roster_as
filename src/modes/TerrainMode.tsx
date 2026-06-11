import React, { useState } from 'react';
import { UserProfile, AppSettings, Astronaute, Session, Report, Grade, Promotion } from '../types';
import PointageScreen from '../screens/terrain/PointageScreen';
import MesEnfantsScreen from '../screens/terrain/MesEnfantsScreen';
import RapportScreen from '../screens/terrain/RapportScreen';
import BottomTabBar, { TerrainTabType } from '../components/BottomTabBar';
import { LogOut, Sliders, ChevronRight } from 'lucide-react';

interface TerrainModeProps {
  currentUser: UserProfile;
  appSettings: AppSettings;
  astronautes: Astronaute[];
  sessions: Session[];
  reports: Report[];
  grades: Grade[];
  promotions: Promotion[];
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  showToast: (msg: string, type: 'success' | 'danger' | 'info') => void;
  triggerCelebration: (title: string, subtitle: string, badgeText: string) => void;
  onSwitchMode?: () => void;
}

export default function TerrainMode({
  currentUser,
  appSettings,
  astronautes,
  sessions,
  reports,
  grades,
  promotions,
  onRefresh,
  onLogout,
  showToast,
  triggerCelebration,
  onSwitchMode
}: TerrainModeProps) {
  const [activeTab, setActiveTab] = useState<TerrainTabType>('pointage');

  const myClass = currentUser.assignment?.classe || 'Aventuriers';
  const myGroup = currentUser.assignment?.groupe || 'Vert';

  // Toggle user permissions/switch mode shortcut
  const canSwitchMode = currentUser.role === 'developer' || currentUser.role === 'leader';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top streamlined header */}
      <header className="bg-slate-900 border-b border-slate-800 shadow p-4 sticky top-0 z-40 select-none">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
              myGroup === 'Vert' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
              myGroup === 'Rouge' ? 'bg-rose-950 text-rose-450 border border-rose-800' :
              myGroup === 'Jaune' ? 'bg-yellow-950 text-yellow-450 border border-yellow-800' :
              'bg-blue-950 text-blue-450 border border-blue-800'
            }`}>
              {myGroup[0]}
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold text-amber-500 tracking-wider leading-none uppercase">MODE TERRAIN</p>
              <h2 className="text-sm font-extrabold text-white leading-tight mt-0.5">
                {currentUser.full_name} • {myClass}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {canSwitchMode && onSwitchMode && (
              <button
                onClick={onSwitchMode}
                className="p-2 bg-slate-800 hover:bg-slate-750 text-amber-400 border border-slate-700/60 rounded-lg cursor-pointer transition active:scale-95"
                title="Passer au Mode Commandement"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onLogout}
              className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700/60 rounded-lg cursor-pointer transition active:scale-95"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main workspace (centered on phone screen layout) */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-20 overflow-y-auto">
        {activeTab === 'pointage' && (
          <PointageScreen
            currentUser={currentUser}
            appSettings={appSettings}
            astronautes={astronautes}
            sessions={sessions}
            onRefresh={onRefresh}
            showToast={showToast}
          />
        )}
        
        {activeTab === 'enfants' && (
          <MesEnfantsScreen
            currentUser={currentUser}
            astronautes={astronautes}
            grades={grades}
            promotions={promotions}
            onRefresh={onRefresh}
            showToast={showToast}
            triggerCelebration={triggerCelebration}
          />
        )}

        {activeTab === 'rapport' && (
          <RapportScreen
            currentUser={currentUser}
            appSettings={appSettings}
            astronautes={astronautes}
            sessions={sessions}
            reports={reports}
            onRefresh={onRefresh}
            showToast={showToast}
          />
        )}
      </main>

      {/* Bottom responsive tab navigation bar */}
      <BottomTabBar activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}
