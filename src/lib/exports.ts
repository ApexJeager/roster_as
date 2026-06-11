/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import { Astronaute, Score } from '../types';

/**
 * Downloads a client-computed CSV file of the provided dataset.
 */
export function exportToCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a beautiful, printable PDF table listing of the roster.
 */
export function exportRosterPDF(astronautes: Astronaute[], roomLabel: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Theme Header background - deep space military theme styling
  doc.setFillColor(11, 17, 32); 
  doc.rect(0, 0, 210, 35, 'F');

  // Title
  doc.setTextColor(245, 158, 11); // Amber
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('RAPPORT ASTRONAUTES', 15, 15);

  // Subtitle
  doc.setTextColor(241, 245, 249); // White slate
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Rôle d'équipage : ${roomLabel} - ASBF Haïti`, 15, 23);
  doc.text(`Génération : ${new Date().toLocaleDateString('fr-FR')}`, 150, 23);

  // Table Body mapping
  const tableData = astronautes.map((a, idx) => [
    idx + 1,
    `${a.first_name} ${a.last_name}`,
    a.birthdate,
    a.classe,
    a.status === 'astronaute_actif' ? 'Actif' : a.status === 'recrue' ? 'Recrue' : 'Inactif',
    `${a.grand_total} pts`,
    a.legacy_source || '-'
  ]);

  const headers = [['#', 'Nom complet', 'Date de Naissance', 'Classe', 'Statut', 'Grand Total', 'Source Historique']];

  // AutoTable injection
  (doc as any).autoTable({
    startY: 42,
    head: headers,
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [19, 28, 49],
      textColor: [241, 158, 11],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      font: 'Helvetica',
      fontSize: 8,
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  doc.save(`Roster_Astronautes_${roomLabel.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates a weekly scorecard checklist summary.
 */
export function exportSessionScoresPDF(
  sessionDate: string,
  roomLabel: string,
  scores: Score[],
  roster: Astronaute[]
) {
  const doc = new jsPDF();

  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('RAPPORT ASTRONAUTES - POINTAGE SÉANCE', 15, 15);

  doc.setTextColor(241, 245, 249);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Unité : ${roomLabel}   |   Séance : vendredi, ${sessionDate}`, 15, 23);

  const tableData = scores.map((sc, idx) => {
    const child = roster.find(r => r.id === sc.astronaute_id);
    return [
      idx + 1,
      child ? `${child.first_name} ${child.last_name}` : 'Inconnu',
      sc.presence ? 'OUI' : 'NON',
      sc.ponctuel ? 'OUI' : 'NON',
      sc.bible ? 'OUI' : 'NON',
      sc.verset ? 'OUI' : 'NON',
      sc.proprete ? 'OUI' : 'NON',
      sc.echarpe ? 'OUI' : 'NON',
      sc.conduite ? 'OUI' : 'NON',
      sc.visiteurs,
      `${sc.total_jour} pts`
    ];
  });

  const headers = [[
    '#', 'Astronaute', 'Près', 'Ponc', 'Bibl', 'Vers', 'Prop', 'Éch', 'Cond', 'Visiteurs', 'Total Séance'
  ]];

  (doc as any).autoTable({
    startY: 42,
    head: headers,
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [19, 28, 49],
      textColor: [245, 158, 11],
      fontSize: 8,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    columnStyles: {
      1: { cellWidth: 40 } // Name column
    }
  });

  doc.save(`Session_Pointages_${sessionDate}_${roomLabel.replace(/\s+/g, '_')}.pdf`);
}
