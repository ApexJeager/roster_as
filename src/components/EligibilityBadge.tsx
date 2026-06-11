/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Grade, Promotion } from '../types';
import { Award, CheckCircle } from 'lucide-react';

interface EligibilityBadgeProps {
  grandTotal: number;
  promotions: Promotion[];
  allGrades: Grade[];
  onTriggerValidate?: (gradeId: string) => void;
  canValidate?: boolean;
}

export default function EligibilityBadge({
  grandTotal,
  promotions,
  allGrades,
  onTriggerValidate,
  canValidate = false
}: EligibilityBadgeProps) {
  // Find all grades where points_required <= grandTotal
  const reachedGrades = allGrades.filter(g => grandTotal >= g.points_required);
  
  // Find which of these aren't yet validated in promotions list
  const validatedGradeIds = new Set(promotions.map(p => p.grade_id));
  const pendingGrades = reachedGrades.filter(g => !validatedGradeIds.has(g.id));

  if (pendingGrades.length === 0) {
    return null;
  }

  // Sort by highest needed point required
  const mostPrestigiousPending = pendingGrades.sort((a, b) => b.points_required - a.points_required)[0];

  return (
    <div
      id={`eligibility-alert-${mostPrestigiousPending.id}`}
      className="bg-amber-500/15 border border-amber-500/40 rounded-lg p-3 text-sm text-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="flex items-start gap-2">
        <Award className="w-5 h-5 text-amber-400 mt-0.5 shrink-0 animate-bounce" />
        <div>
          <p className="font-semibold text-amber-300">
            Éligible : <span className="underline font-bold text-white">{mostPrestigiousPending.name}</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Verset : <span className="font-mono text-amber-200">{mostPrestigiousPending.verses}</span>
          </p>
        </div>
      </div>
      
      {canValidate && onTriggerValidate && (
        <button
          id={`btn-validate-grade-${mostPrestigiousPending.id}`}
          type="button"
          onClick={() => onTriggerValidate(mostPrestigiousPending.id)}
          className="bg-amber-500 hover:bg-amber-600 active:transform active:scale-95 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 self-start sm:self-center transition-all cursor-pointer shadow-md shadow-amber-500/10"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Marquer réussi</span>
        </button>
      )}
    </div>
  );
}
