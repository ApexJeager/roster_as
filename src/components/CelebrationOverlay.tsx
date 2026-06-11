/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Star, Sparkles, Award } from 'lucide-react';

interface CelebrationOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  badgeText?: string;
}

export default function CelebrationOverlay({
  isVisible,
  onClose,
  title,
  subtitle,
  badgeText
}: CelebrationOverlayProps) {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReduced(mediaQuery.matches);
      
      const listener = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Automatically close celebration after 5 seconds to not hold up users
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
        {/* Simple Fade-In if user prefers reduced motion */}
        {prefersReduced ? (
          <div className="bg-slate-900 border border-amber-500/40 max-w-md w-full p-6 rounded-2xl text-center space-y-4 shadow-2xl shadow-amber-500/15">
            <Award className="w-16 h-16 text-amber-400 mx-auto" />
            <h2 className="text-2xl font-display font-bold text-white">{title}</h2>
            <p className="text-slate-300 text-sm">{subtitle}</p>
            {badgeText && (
              <span className="inline-block bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded-full text-xs font-mono">
                {badgeText}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-sm cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : (
          /* High-Fidelity Rocket Launch & Sparkles Animation with Framer Motion */
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/20 max-w-md w-full p-8 rounded-2xl text-center relative overflow-hidden shadow-2xl shadow-amber-500/10"
          >
            {/* Background elements (sparkles & stars) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{
                    x: Math.random() * 300 - 150 + 180,
                    y: Math.random() * 300 - 150 + 150,
                    scale: 0,
                    opacity: 0
                  }}
                  animate={{
                    scale: [0, 1.2, 0],
                    opacity: [0, 0.8, 0]
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: i * 0.4
                  }}
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </motion.div>
              ))}

              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`star-${i}`}
                  className="absolute"
                  initial={{
                    x: Math.random() * 300 - 150 + 180,
                    y: Math.random() * 300 - 150 + 200,
                    scale: 0,
                    opacity: 0
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 0.6, 0]
                  }}
                  transition={{
                    duration: 1.5 + Math.random() * 1.5,
                    repeat: Infinity,
                    delay: i * 0.5
                  }}
                >
                  <Star className="w-3.5 h-3.5 text-blue-400" />
                </motion.div>
              ))}
            </div>

            {/* Simulated Rocket Launch Lift off animation */}
            <div className="relative h-24 mb-6">
              <motion.div
                className="absolute left-1/2 -ml-10 bottom-0"
                initial={{ y: 80, scale: 0.8, opacity: 0 }}
                animate={{
                  y: [-10, -5, -40, -50],
                  scale: [1, 1, 1.1, 0.9],
                  opacity: [1, 1, 1, 0]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <div className="relative">
                  <Rocket className="w-16 h-16 text-amber-500 transform rotate-45 stroke-[1.5]" />
                  {/* Propeller fire flash */}
                  <motion.div
                    className="absolute -bottom-3 -left-1 w-6 h-6 bg-red-600 rounded-full blur-sm"
                    animate={{ scale: [1, 1.8, 1] }}
                    transition={{ duration: 0.15, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -bottom-2 w-4 h-4 bg-amber-500 rounded-full blur-xs"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 0.1, repeat: Infinity }}
                  />
                </div>
              </motion.div>
            </div>

            <h2 className="text-2xl font-display font-bold text-white tracking-tight">
              {title}
            </h2>
            <p className="text-slate-300 text-sm mt-2">
              {subtitle}
            </p>

            <div className="mt-6">
              {badgeText && (
                <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-900 font-extrabold px-4 py-1.5 rounded-full text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20">
                  <Award className="w-3.5 h-3.5" />
                  <span>{badgeText}</span>
                </span>
              )}
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/80 font-semibold py-2.5 rounded-lg text-sm transition-all cursor-pointer"
              >
                Continuer l'exploration
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
