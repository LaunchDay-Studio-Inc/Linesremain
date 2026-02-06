// ─── Button Component ───

import React from 'react';
import '../../styles/panels.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
}) => {
  const classes = [
    'btn',
    `btn--${variant}`,
    loading ? 'btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} onClick={onClick}>
      {loading && <span className="btn__spinner" />}
      {children}
    </button>
  );
};