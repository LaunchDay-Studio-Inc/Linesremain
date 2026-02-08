// ─── Tutorial Overlay ───
// Contextual tutorial hints displayed at the bottom of the screen during onboarding.

import type { TutorialStep } from '@shared/types/customization';
import { TUTORIAL_HINTS } from '@shared/types/customization';
import { ClientMessage } from '@shared/types/network';
import React, { useCallback } from 'react';
import { socketClient } from '../../network/SocketClient';
import { useAchievementStore } from '../../stores/useAchievementStore';
import '../../styles/progression.css';

export const TutorialOverlay: React.FC = () => {
  const tutorialStep = useAchievementStore((s) => s.tutorialStep);
  const tutorialComplete = useAchievementStore((s) => s.tutorialComplete);

  const handleSkip = useCallback(() => {
    socketClient.emit(ClientMessage.TutorialSkip, {});
  }, []);

  if (tutorialComplete || !tutorialStep || tutorialStep === 'complete') return null;

  const hint = TUTORIAL_HINTS[tutorialStep as Exclude<TutorialStep, 'complete'>];
  if (!hint) return null;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <div className="tutorial-card__title">{hint.title}</div>
        <div className="tutorial-card__hint">{hint.hint}</div>
        {hint.key && (
          <div className="tutorial-card__key">
            Press <kbd>{hint.key}</kbd>
          </div>
        )}
        <button className="tutorial-card__skip" onClick={handleSkip}>
          Skip Tutorial
        </button>
      </div>
    </div>
  );
};
