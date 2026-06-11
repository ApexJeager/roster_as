/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Grade, Promotion } from '../types';
import { Shield, CheckCircle, Lock, Award } from 'lucide-react';

interface RankTrackProps {
  grandTotal: number;
  promotions: Promotion[];
  allGrades: Grade[];
}

export default function RankTrack({ grandTotal, promotions, allGrades }: RankTrackProps) {
  // Map validated promotions
  const validatedGradeIds = new Set(promotions.map(p => p.grade_id));

  // Sort grades by required points
  const sortedGrades = [...allGrades].sort((a, b) => a.sort_order - b.sort_order);

  // Determine current active highest validated rank
  const validatedGrades = sortedGrades.filter(g => validatedGradeIds.has(g.id));
  const highestValidated = validatedGrades[validatedGrades.length - 1] || null;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-850 pb-3 mb-4 gap-2">
        <div>
          <h3 className="font-display font-semibold text-slate-200 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <span>Tableau des Rangs des Astronautes</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Progression militaire basée sur le Grand Total de points.
          </p>
        </div>
        <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-center">
          <p className="text-[10px] text-slate-400 font-medium">Rang Actuel Décroché</p>
          <p className="text-sm font-bold text-amber-400 font-display">
            {highestValidated ? highestValidated.name : 'Nouvelle Recrue'}
          </p>
        </div>
      </div>

      {/* Ranks list representation */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
        {sortedGrades.map((g, idx) => {
          const isValidated = validatedGradeIds.has(g.id);
          const isEligible = grandTotal >= g.points_required && !isValidated;
          const isLocked = grandTotal < g.points_required;

          return (
            <div
              key={g.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs gap-3 ${
                isValidated
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-200'
                  : isEligible
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                    : 'bg-slate-950/20 border-slate-900/60 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isValidated ? (
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                ) : isEligible ? (
                  <Award className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                ) : (
                  <Lock className="w-4.5 h-4.5 text-slate-700 shrink-0" />
                )}

                <div className="min-w-0">
                  <p className={`font-semibold truncate ${isValidated ? 'text-white' : isEligible ? 'text-amber-200' : 'text-slate-500'}`}>
                    {g.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    Verset à réciter : <span className="font-mono text-slate-400">{g.verses}</span>
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-xs font-bold tabular-nums">
                  {g.points_required}
                </span>
                <span className="text-[10px] text-slate-500 font-sans ml-1">pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
