// ─── Tutorial Overlay ───
// Minimal glass-panel tutorial hints at bottom-center with progress dots.

import type { TutorialStep } from '@shared/types/customization';
import { TUTORIAL_HINTS } from '@shared/types/customization';
import { ClientMessage } from '@shared/types/network';
import React, { useCallback, useEffect, useState } from 'react';
import { sfxSystem } from '../../engine/SFXSystem';
import { socketClient } from '../../network/SocketClient';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useGameStore } from '../../stores/useGameStore';
import '../../styles/tutorial.css';

// Steps in order (excluding 'complete')
const STEP_ORDER: Exclude<TutorialStep, 'complete'>[] = [
  'move',
  'gather',
  'craft',
  'build',
];

const STEP_ICONS: Record<string, string> = {
  move: '🏃',
  gather: '⛏️',
  craft: '🔨',
  build: '🏠',
};

export const TutorialOverlay: React.FC = () => {
  const tutorialStep = useAchievementStore((s) => s.tutorialStep);
  const tutorialComplete = useAchievementStore((s) => s.tutorialComplete);
  const [mounted, setMounted] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  // Delay mount for a smooth entrance after character select
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Re-trigger step animation when step changes
  useEffect(() => {
    setFadeKey((k) => k + 1);
    try {
      sfxSystem.playChime();
    } catch {
      // SFX not initialized yet — harmless
    }
  }, [tutorialStep]);

  const handleSkip = useCallback(() => {
    const isOffline = useGameStore.getState().isOffline;
    if (isOffline) {
      useAchievementStore.getState().completeTutorial();
    } else {
      socketClient.emit(ClientMessage.TutorialSkip, {});
    }
  }, []);

  if (!mounted || tutorialComplete || !tutorialStep || tutorialStep === 'complete') {
    return null;
  }

  const hint = TUTORIAL_HINTS[tutorialStep as Exclude<TutorialStep, 'complete'>];
  if (!hint) return null;

  const currentIdx = STEP_ORDER.indexOf(tutorialStep as Exclude<TutorialStep, 'complete'>);
  const icon = STEP_ICONS[tutorialStep] ?? '📋';

  return (
    <div className="tut">
      <div className="tut__card" key={fadeKey}>
        <div className="tut__icon">{icon}</div>
        <div className="tut__body">
          <div className="tut__title">{hint.title}</div>
          <div className="tut__hint">{hint.hint}</div>
        </div>
        {hint.key && (
          <div className="tut__key-area">
            <span className="tut__key">{hint.key}</span>
          </div>
        )}
      </div>

      {/* Progress Dots */}
      <div className="tut__progress">
        {STEP_ORDER.map((step, i) => {
          let cls = 'tut__dot';
          if (i < currentIdx) cls += ' tut__dot--done';
          else if (i === currentIdx) cls += ' tut__dot--active';
          return <span key={step} className={cls} />;
        })}
      </div>

      <button className="tut__skip" onClick={handleSkip}>
        SKIP TUTORIAL
      </button>
    </div>
  );
};
