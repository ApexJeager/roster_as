/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Minus, Plus, Users } from 'lucide-react';

interface VisitorCounterProps {
  value: number;
  onChange: (newValue: number) => void;
  disabled?: boolean;
}

export default function VisitorCounter({ value, onChange, disabled = false }: VisitorCounterProps) {
  const handleDec = () => {
    if (disabled || value <= 0) return;
    onChange(value - 1);
  };

  const handleInc = () => {
    if (disabled) return;
    onChange(value + 1);
  };

  return (
    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-300">Visiteur (Invité amené)</span>
      </div>
      
      <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 p-1 rounded-md">
        <button
          id="btn-visiteur-decrement"
          type="button"
          onClick={handleDec}
          disabled={disabled || value <= 0}
          className={`w-11 h-11 flex items-center justify-center rounded-md border text-slate-300 transition-all cursor-pointer ${
            disabled || value <= 0
              ? 'opacity-30 border-slate-800 cursor-not-allowed'
              : 'border-slate-800 hover:bg-slate-800 hover:text-white active:scale-95'
          }`}
          title="Soustraire un visiteur"
        >
          <Minus className="w-4 h-4" />
        </button>
        
        <span
          id="visiteur-count-display"
          className="w-12 text-center text-sm font-bold font-mono text-amber-400 tabular-nums"
        >
          {value}
        </span>
        
        <button
          id="btn-visiteur-increment"
          type="button"
          onClick={handleInc}
          disabled={disabled}
          className={`w-11 h-11 flex items-center justify-center rounded-md border text-slate-300 transition-all cursor-pointer ${
            disabled
              ? 'opacity-30 border-slate-800 cursor-not-allowed'
              : 'border-slate-800 hover:bg-slate-800 hover:text-white active:scale-95'
          }`}
          title="Ajouter un visiteur"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
