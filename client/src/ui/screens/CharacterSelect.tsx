// ─── Character Selection Screen ───
// Premium character archetype picker with live preview and animated transitions.

import {
  BODY_TYPES,
  BODY_TYPE_DEFINITIONS,
  FREE_COLORS,
  type BodyType,
} from '@shared/types/customization';
import { ClientMessage } from '@shared/types/network';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { generateCharacterPreview } from '../../assets/SpriteGenerator';
import { socketClient } from '../../network/SocketClient';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useGameStore } from '../../stores/useGameStore';
import '../../styles/character-select.css';

export const CharacterSelect: React.FC = () => {
  const [selectedType, setSelectedType] = useState<BodyType>('striker');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [hoveredType, setHoveredType] = useState<BodyType | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const setScreen = useGameStore((s) => s.setScreen);
  const setCustomization = useAchievementStore((s) => s.setCustomization);

  // Draw preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const previewType = hoveredType ?? selectedType;
    const preview = generateCharacterPreview(previewType, selectedColor, 256);
    const x = (canvas.width - 256) / 2;
    const y = (canvas.height - 256) / 2;
    ctx.drawImage(preview, x, y);
  }, [selectedType, selectedColor, hoveredType]);

  const handleConfirm = useCallback(() => {
    setConfirmed(true);

    const customization = useAchievementStore.getState().customization;
    setCustomization({
      ...customization,
      bodyType: selectedType,
      bodyColor: selectedColor,
    });

    socketClient.emit(ClientMessage.Customize, {
      bodyType: selectedType,
      bodyColor: selectedColor,
      accessory: customization.accessory,
      trail: customization.trail,
      deathEffect: customization.deathEffect,
      title: customization.title,
    });

    setTimeout(() => {
      setScreen('loading');
    }, 800);
  }, [selectedType, selectedColor, setScreen, setCustomization]);

  return (
    <div className="charsel">
      <div className="charsel__bg" />

      <div className="charsel__header">
        <h1 className="charsel__title">CHOOSE YOUR LINE</h1>
        <p className="charsel__subtitle">Select your archetype. Your line begins here.</p>
      </div>

      <div className="charsel__content">
        {/* Left: Large Preview */}
        <div className="charsel__preview-area">
          <canvas
            ref={previewCanvasRef}
            width={400}
            height={400}
            className="charsel__preview-canvas"
          />
          <div className="charsel__preview-info">
            <h2 className="charsel__preview-name">
              {BODY_TYPE_DEFINITIONS[hoveredType ?? selectedType].displayName}
            </h2>
            <p className="charsel__preview-desc">
              {BODY_TYPE_DEFINITIONS[hoveredType ?? selectedType].description}
            </p>
          </div>
        </div>

        {/* Right: Grid + Colors */}
        <div className="charsel__options">
          <div className="charsel__section-label">ARCHETYPE</div>
          <div className="charsel__grid">
            {BODY_TYPES.map((type) => {
              const def = BODY_TYPE_DEFINITIONS[type];
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  className={`charsel__card ${isSelected ? 'charsel__card--selected' : ''}`}
                  onClick={() => setSelectedType(type)}
                  onMouseEnter={() => setHoveredType(type)}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <CharacterThumbnail type={type} color={selectedColor} />
                  <span className="charsel__card-name">{def.displayName}</span>
                </button>
              );
            })}
          </div>

          <div className="charsel__section-label">LINE COLOR</div>
          <div className="charsel__colors">
            {FREE_COLORS.map((color) => (
              <button
                key={color}
                className={`charsel__color-swatch ${selectedColor === color ? 'charsel__color-swatch--selected' : ''}`}
                style={{ background: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="charsel__footer">
        <button
          className={`charsel__confirm ${confirmed ? 'charsel__confirm--loading' : ''}`}
          onClick={handleConfirm}
          disabled={confirmed}
        >
          {confirmed ? 'DRAWING YOUR LINE...' : 'BEGIN'}
        </button>
      </div>
    </div>
  );
};

// ─── Thumbnail Component ───

const CharacterThumbnail: React.FC<{ type: BodyType; color: string }> = ({ type, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 64, 64);
    const preview = generateCharacterPreview(type, color, 64);
    ctx.drawImage(preview, 0, 0);
  }, [type, color]);

  return <canvas ref={canvasRef} width={64} height={64} className="charsel__thumb" />;
};
