// ─── Building Panel ───

import { BUILDING_REGISTRY } from '@shared/constants/buildings';
import { BuildingPieceType, BuildingTier } from '@shared/types/buildings';
import { useCallback, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';

// ─── Tier Config ───

const BUILDING_TIERS: { tier: BuildingTier; label: string; color: string }[] = [
  { tier: BuildingTier.Twig, label: 'Twig', color: '#a08060' },
  { tier: BuildingTier.Wood, label: 'Wood', color: '#c49a6c' },
  { tier: BuildingTier.Stone, label: 'Stone', color: '#8a8a9a' },
  { tier: BuildingTier.Metal, label: 'Metal', color: '#7ec8e3' },
  { tier: BuildingTier.Armored, label: 'Armored', color: '#e8c547' },
];

// ─── Item Names ───

const ITEM_NAMES: Record<number, string> = {
  1: 'Wood',
  2: 'Stone',
  10: 'Metal Frags',
  12: 'HQM',
};

// ─── Piece Definitions ───

interface BuildingPieceUI {
  type: BuildingPieceType;
  icon: string;
  label: string;
}

const BUILDING_PIECES: BuildingPieceUI[] = [
  { type: BuildingPieceType.Foundation, icon: '⬜', label: 'Foundation' },
  { type: BuildingPieceType.FoundationTriangle, icon: '🔻', label: 'Tri Foundation' },
  { type: BuildingPieceType.Wall, icon: '🧱', label: 'Wall' },
  { type: BuildingPieceType.HalfWall, icon: '▬', label: 'Half Wall' },
  { type: BuildingPieceType.Doorway, icon: '🚪', label: 'Doorway' },
  { type: BuildingPieceType.WindowFrame, icon: '🪟', label: 'Window' },
  { type: BuildingPieceType.WallFrame, icon: '🖼️', label: 'Wall Frame' },
  { type: BuildingPieceType.Floor, icon: '⬛', label: 'Floor' },
  { type: BuildingPieceType.FloorTriangle, icon: '◢', label: 'Tri Floor' },
  { type: BuildingPieceType.Stairs, icon: '📐', label: 'Stairs' },
  { type: BuildingPieceType.Roof, icon: '🔺', label: 'Roof' },
  { type: BuildingPieceType.Door, icon: '🚪', label: 'Door' },
  { type: BuildingPieceType.Fence, icon: '🏗️', label: 'Fence' },
  { type: BuildingPieceType.Pillar, icon: '🏛️', label: 'Pillar' },
];

// ─── Props ───

interface BuildingPanelProps {
  onSelectPiece?: (pieceType: BuildingPieceType, tier: BuildingTier) => void;
  onCancelPreview?: () => void;
}

// ─── Component ───

export const BuildingPanel: React.FC<BuildingPanelProps> = ({ onSelectPiece, onCancelPreview }) => {
  const buildingMode = useUIStore((s) => s.buildingMode);
  const [activeTierIndex, setActiveTierIndex] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState<BuildingPieceType | null>(null);

  const activeTier = BUILDING_TIERS[activeTierIndex]?.tier ?? BuildingTier.Twig;
  const activeTierConfig = BUILDING_TIERS[activeTierIndex];

  const handlePieceClick = useCallback(
    (piece: BuildingPieceUI) => {
      if (selectedPiece === piece.type) {
        setSelectedPiece(null);
        onCancelPreview?.();
      } else {
        setSelectedPiece(piece.type);
        onSelectPiece?.(piece.type, activeTier);
      }
    },
    [selectedPiece, activeTier, onSelectPiece, onCancelPreview],
  );

  const handleTierChange = useCallback(
    (index: number) => {
      setActiveTierIndex(index);
      const newTier = BUILDING_TIERS[index]?.tier ?? BuildingTier.Twig;
      if (selectedPiece) {
        onSelectPiece?.(selectedPiece, newTier);
      }
    },
    [selectedPiece, onSelectPiece],
  );

  if (!buildingMode) return null;

  const selectedStats = selectedPiece ? BUILDING_REGISTRY[selectedPiece] : null;
  const upgradeCosts = selectedStats?.upgradeCosts[activeTier] ?? [];
  const healthAtTier = selectedStats?.healthPerTier[activeTier] ?? 0;

  return (
    <div className="building-panel">
      {/* Header */}
      <div className="bp-header">
        <span className="bp-header__icon">🔨</span>
        <span className="bp-header__title">BUILDING</span>
        <span className="bp-header__tier" style={{ color: activeTierConfig?.color }}>
          {activeTierConfig?.label}
        </span>
      </div>

      {/* Tier Tabs */}
      <div className="bp-tiers">
        {BUILDING_TIERS.map((tier, i) => (
          <button
            key={tier.label}
            className={`bp-tier-tab${i === activeTierIndex ? ' bp-tier-tab--active' : ''}`}
            onClick={() => handleTierChange(i)}
            style={
              i === activeTierIndex
                ? { borderBottomColor: tier.color, color: tier.color }
                : undefined
            }
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* Piece Grid */}
      <div className="bp-grid">
        {BUILDING_PIECES.map((piece) => {
          const stats = BUILDING_REGISTRY[piece.type];
          const hp = stats?.healthPerTier[activeTier] ?? 0;
          const isAvailable = hp > 0;
          const isSelected = selectedPiece === piece.type;

          return (
            <div
              key={piece.type}
              className={`bp-piece${isSelected ? ' bp-piece--selected' : ''}${!isAvailable ? ' bp-piece--locked' : ''}`}
              onClick={() => isAvailable && handlePieceClick(piece)}
              title={isAvailable ? `${piece.label} — ${hp} HP` : `${piece.label} — Not available`}
            >
              <span className="bp-piece__icon">{piece.icon}</span>
              <span className="bp-piece__label">{piece.label}</span>
              {isAvailable ? (
                <span className="bp-piece__hp">
                  {hp}
                  <small> HP</small>
                </span>
              ) : (
                <span className="bp-piece__lock">🔒</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Piece Detail */}
      {selectedPiece && selectedStats && (
        <div className="bp-detail">
          <div className="bp-detail__name">
            🛡️ <strong>{selectedPiece}</strong>
          </div>
          <div className="bp-detail__hp">{healthAtTier} HP</div>
          <div className="bp-detail__cost">
            {upgradeCosts.length > 0 ? (
              upgradeCosts.map((cost) => (
                <span key={cost.itemId} className="bp-detail__mat">
                  {ITEM_NAMES[cost.itemId] ?? `#${cost.itemId}`} ×{cost.quantity}
                </span>
              ))
            ) : (
              <span className="bp-detail__free">Free</span>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bp-controls">
        <span>🖱️ Click to place</span>
        <span className="bp-controls__sep">•</span>
        <span>R — Rotate</span>
        <span className="bp-controls__sep">•</span>
        <span>ESC — Cancel</span>
      </div>
    </div>
  );
};
