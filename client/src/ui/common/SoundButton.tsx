// ─── Sound Button ───
// Wrapper button that plays hover/click sounds via AudioManager.

import React from 'react';
import { AudioManager } from '../../engine/AudioManager';

interface SoundButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const SoundButton: React.FC<SoundButtonProps> = ({
  children,
  onMouseEnter,
  onClick,
  ...rest
}) => {
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    AudioManager.getInstance().play('uiHover');
    onMouseEnter?.(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
  };

  return (
    <button onMouseEnter={handleMouseEnter} onClick={handleClick} {...rest}>
      {children}
    </button>
  );
};
