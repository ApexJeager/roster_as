/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GroupeType } from '../types';

interface GroupBadgeProps {
  groupe: GroupeType;
  className?: string;
}

export default function GroupBadge({ groupe, className = '' }: GroupBadgeProps) {
  const meta: Record<GroupeType, { bg: string; dot: string; text: string; label: string }> = {
    Jaune: {
      bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      dot: 'bg-yellow-500',
      text: 'text-yellow-400',
      label: 'Groupe Jaune'
    },
    Bleu: {
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      dot: 'bg-blue-500',
      text: 'text-blue-400',
      label: 'Groupe Bleu'
    },
    Vert: {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-500',
      text: 'text-emerald-400',
      label: 'Groupe Vert'
    },
    Rouge: {
      bg: 'bg-red-500/10 text-red-400 border-red-500/30',
      dot: 'bg-red-500',
      text: 'text-red-400',
      label: 'Groupe Rouge'
    }
  };

  const styling = meta[groupe] || meta.Jaune;

  return (
    <span
      id={`group-badge-${groupe.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${styling.bg} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${styling.dot} animate-pulse`} />
      <span>{styling.label}</span>
    </span>
  );
}
