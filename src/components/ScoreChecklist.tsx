/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Score } from '../types';
import VisitorCounter from './VisitorCounter';
import { Check, Loader, Sparkles } from 'lucide-react';

interface ScoreChecklistProps {
  score: Partial<Score>;
  onSave: (updated: Partial<Score>) => Promise<void>;
  disabled?: boolean;
}

interface MetricDesc {
  key: keyof Omit<Score, 'id' | 'session_id' | 'astronaute_id' | 'visiteurs' | 'total_jour'>;
  label: string;
  points: number;
  description: string;
}

const METRICS: MetricDesc[] = [
  { key: 'presence', label: 'Présence', points: 30, description: 'Est présent à la séance de vendredi' },
  { key: 'ponctuel', label: 'Ponctuel', points: 40, description: 'Arrivé à l\'heure de la cérémonie de lever' },
  { key: 'bible', label: 'Bible', points: 50, description: 'A apporté sa propre Bible' },
  { key: 'verset', label: 'Verset du Jour', points: 40, description: 'Récitation réussie du verset de la semaine' },
  { key: 'proprete', label: 'Propreté', points: 30, description: 'Uniforme propre et boutons ajustés' },
  { key: 'echarpe', label: 'Écharpe', points: 20, description: 'Porte l\'écharpe officielle cousue' },
  { key: 'conduite', label: 'Conduite', points: 40, description: 'Comportement exemplaire tout au long de la pièce' }
];

export default function ScoreChecklist({ score, onSave, disabled = false }: ScoreChecklistProps) {
  // Local state for optimistic updates
  const [localScore, setLocalScore] = useState<Partial<Score>>(score);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Settle effect when parent properties change
  useEffect(() => {
    setLocalScore(score);
  }, [score]);

  // Points sum math
  const getChecksPoints = (s: Partial<Score>) => {
    let sum = 0;
    if (s.presence) sum += 30;
    if (s.ponctuel) sum += 40;
    if (s.bible) sum += 50;
    if (s.verset) sum += 40;
    if (s.proprete) sum += 30;
    if (s.echarpe) sum += 20;
    if (s.conduite) sum += 40;
    return sum;
  };

  const currentChecksTotal = getChecksPoints(localScore);
  const visitorsCount = localScore.visiteurs || 0;
  const grandTotalJour = currentChecksTotal + (visitorsCount * 25);

  const triggerSave = async (updatedFields: Partial<Score>) => {
    const fullUpdate = { ...localScore, ...updatedFields };
    setLocalScore(fullUpdate);
    setSaveState('saving');
    setErrorMessage('');
    try {
      await onSave(fullUpdate);
      setSaveState('saved');
      setTimeout(() => {
        setSaveState(prev => prev === 'saved' ? 'idle' : prev);
      }, 1500);
    } catch (err: any) {
      setSaveState('failed');
      setErrorMessage(err.message || 'Une erreur est survenue.');
    }
  };

  const handleToggle = (key: keyof Omit<Score, 'id' | 'session_id' | 'astronaute_id' | 'visiteurs' | 'total_jour'>) => {
    if (disabled) return;
    const nextVal = !localScore[key];
    triggerSave({ [key]: nextVal });
  };

  const handleVisitorsChange = (count: number) => {
    if (disabled) return;
    triggerSave({ visiteurs: count });
  };

  return (
    <div className="space-y-4">
      {/* List of 7 checkboxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {METRICS.map(m => {
          const checked = !!localScore[m.key];
          return (
            <button
              id={`metric-btn-${m.key}`}
              key={m.key}
              type="button"
              disabled={disabled}
              onClick={() => handleToggle(m.key)}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all relative ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-slate-700'
              } ${
                checked
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
              style={{ minHeight: '52px' }}
            >
              {/* Massive 44x44 Touch Target Container around Checkbox Area */}
              <div className="flex items-center justify-center w-6 h-6 rounded border shrink-0 mt-0.5 transition-all outline-none"
                   style={{
                     borderColor: checked ? '#10b981' : '#475569',
                     backgroundColor: checked ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                   }}
              >
                {checked && <Check className="w-4 h-4 text-emerald-400 stroke-[3px]" />}
              </div>

              <div className="flex-1 pr-6">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs sm:text-sm">{m.label}</span>
                  <span className="text-[10px] font-mono bg-slate-950 px-1.5 py-0.5 rounded text-amber-400">
                    +{m.points} pts
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{m.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Visitor Stepper */}
      <VisitorCounter
        value={visitorsCount}
        onChange={handleVisitorsChange}
        disabled={disabled}
      />

      {/* Points Summary & Feedback Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-xs text-slate-400 font-medium">Session Total du Jour</p>
            <p className="text-xl font-bold font-mono text-amber-400 tabular-nums">
              {grandTotalJour} <span className="text-xs text-slate-500 font-sans font-normal">/ 275 max</span>
            </p>
          </div>
        </div>

        <div className="flex items-center md:justify-end gap-2.5">
          {saveState === 'saving' && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Loader className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>Enregistrement...</span>
            </span>
          )}
          {saveState === 'saved' && (
            <span id="save-status-badge" className="text-xs text-emerald-400 font-bold flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" />
              <span>Enregistré ✓</span>
            </span>
          )}
          {saveState === 'failed' && (
            <span className="text-xs text-red-400 font-medium bg-red-950 px-2.5 py-1 rounded border border-red-500/10">
              {errorMessage}
            </span>
          )}
          {disabled && (
            <span className="text-[10px] font-bold text-slate-500 border border-slate-800 bg-slate-900 px-2 py-1 rounded">
              LECTURE SEULE
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
