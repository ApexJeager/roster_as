import React, { useState } from 'react';
import { UserProfile, AppSettings, Astronaute, Session, Report, Grade, Promotion, ClasseType, GroupeType } from '../types';
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
  isOnline: boolean;
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
  onSwitchMode,
  isOnline
}: TerrainModeProps) {
  const [activeTab, setActiveTab] = useState<TerrainTabType>('pointage');

  // Check if role is developer (Dev)
  const isDev = currentUser.role === 'developer';

  const [devClass, setDevClass] = useState<ClasseType>('Aventuriers');
  const [devGroup, setDevGroup] = useState<GroupeType>('Vert');

  const myClass = isDev ? devClass : (currentUser.assignment?.classe || 'Aventuriers');
  const myGroup = isDev ? devGroup : (currentUser.assignment?.groupe || 'Vert');

  // Dynamic prop override so child components naturally receive the selected coordinator
  const customUser = React.useMemo(() => {
    return {
      ...currentUser,
      assignment: {
        classe: myClass,
        groupe: myGroup
      }
    };
  }, [currentUser, myClass, myGroup]);

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
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-[10px] font-mono font-bold text-amber-500 tracking-wider uppercase">MODE TERRAIN</span>
                <span 
                  className={`w-2 h-2 rounded-full inline-block ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-red-500 shadow-sm shadow-red-500/50'}`}
                  title={isOnline ? 'Base de données Firebase connectée' : 'Connexion Firebase perdue (Hors-ligne)'}
                />
              </div>
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
        {/* DEV ONLY CABIN SELECTION OVERRIDE DROPDOWN BOX */}
        {isDev && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-4 shadow space-y-2 select-none text-left" id="dev-cabin-selector">
            <span className="text-[10px] font-mono font-black text-amber-500 tracking-widest uppercase block">🛠️ OPTIONS PILOTE DE VOL (DÉVELOPPEUR)</span>
            <p className="text-[10px] text-slate-400">
              Sélectionnez ci-dessous la cabine que vous co-pilotez ce vendredi. Tout l'affichage, les pointages et les rapports viseront instantanément votre choix.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[9px] font-mono text-slate-500 block mb-1">CABINE (CLASSE)</label>
                <select 
                  id="dev-class-dropdown"
                  value={devClass}
                  onChange={(e) => setDevClass(e.target.value as ClasseType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="Pionniers">Pionniers (4-6 ans)</option>
                  <option value="Explorateurs">Explorateurs (7-8 ans)</option>
                  <option value="Aventuriers">Aventuriers (9-11 ans)</option>
                  <option value="Aigles">Aigles (12-14 ans)</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-mono text-slate-500 block mb-1">GROUPE / UNITÉ</label>
                <select 
                  id="dev-group-dropdown"
                  value={devGroup}
                  onChange={(e) => setDevGroup(e.target.value as GroupeType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="Jaune">Jaune</option>
                  <option value="Bleu">Bleu</option>
                  <option value="Vert">Vert</option>
                  <option value="Rouge">Rouge</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pointage' && (
          <PointageScreen
            currentUser={customUser}
            appSettings={appSettings}
            astronautes={astronautes}
            sessions={sessions}
            onRefresh={onRefresh}
            showToast={showToast}
          />
        )}
        
        {activeTab === 'enfants' && (
          <MesEnfantsScreen
            currentUser={customUser}
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
            currentUser={customUser}
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
