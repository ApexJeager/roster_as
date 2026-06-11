import React from 'react';
import { Calendar, Users, FileText } from 'lucide-react';

export type TerrainTabType = 'pointage' | 'enfants' | 'rapport';

interface BottomTabBarProps {
  activeTab: TerrainTabType;
  onChangeTab: (tab: TerrainTabType) => void;
}

export default function BottomTabBar({ activeTab, onChangeTab }: BottomTabBarProps) {
  const tabs = [
    { id: 'pointage' as TerrainTabType, label: 'Pointage', icon: <Calendar className="w-5 h-5" /> },
    { id: 'enfants' as TerrainTabType, label: 'Mes Enfants', icon: <Users className="w-5 h-5" /> },
    { id: 'rapport' as TerrainTabType, label: 'Rapport', icon: <FileText className="w-5 h-5" /> }
  ];

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.5)] z-40 select-none">
      <div className="max-w-md mx-auto grid grid-cols-3 h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center font-bold text-xs gap-1 cursor-pointer transition ${
                isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`p-1 rounded-lg transition-transform ${isActive ? 'scale-110' : ''}`}>
                {tab.icon}
              </div>
              <span className="text-[10px] tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
