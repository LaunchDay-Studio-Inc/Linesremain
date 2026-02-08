// ─── Building Panel ───

import { BUILDING_REGISTRY } from '@shared/constants/buildings';
import { BuildingPieceType, BuildingTier } from '@shared/types/buildings';
import { useCallback, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';
import { GameIcon, type IconName } from '../common/GameIcon';

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
  iconName: IconName;
  label: string;
}

const BUILDING_PIECES: BuildingPieceUI[] = [
  { type: BuildingPieceType.Foundation, iconName: 'foundation', label: 'Foundation' },
  { type: BuildingPieceType.FoundationTriangle, iconName: 'foundation-tri', label: 'Tri Found.' },
  { type: BuildingPieceType.Wall, iconName: 'wall', label: 'Wall' },
  { type: BuildingPieceType.HalfWall, iconName: 'half-wall', label: 'Half Wall' },
  { type: BuildingPieceType.Doorway, iconName: 'doorway', label: 'Doorway' },
  { type: BuildingPieceType.WindowFrame, iconName: 'window', label: 'Window' },
  { type: BuildingPieceType.WallFrame, iconName: 'wall-frame', label: 'Frame' },
  { type: BuildingPieceType.Floor, iconName: 'floor', label: 'Floor' },
  { type: BuildingPieceType.FloorTriangle, iconName: 'floor-tri', label: 'Tri Floor' },
  { type: BuildingPieceType.Stairs, iconName: 'stairs', label: 'Stairs' },
  { type: BuildingPieceType.Roof, iconName: 'roof', label: 'Roof' },
  { type: BuildingPieceType.Door, iconName: 'door', label: 'Door' },
  { type: BuildingPieceType.Fence, iconName: 'fence', label: 'Fence' },
  { type: BuildingPieceType.Pillar, iconName: 'pillar', label: 'Pillar' },
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
        <span className="bp-header__icon">
          <GameIcon name="hammer" size={16} />
        </span>
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
              <span className="bp-piece__icon">
                <GameIcon
                  name={piece.iconName}
                  size={22}
                  color={
                    !isAvailable
                      ? 'rgba(255,255,255,0.2)'
                      : isSelected
                        ? 'var(--accent)'
                        : 'rgba(255,255,255,0.8)'
                  }
                />
              </span>
              <span className="bp-piece__label">{piece.label}</span>
              {isAvailable ? (
                <span className="bp-piece__hp">
                  {hp}
                  <small> HP</small>
                </span>
              ) : (
                <span className="bp-piece__lock">
                  <GameIcon name="lock" size={14} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Piece Detail */}
      {selectedPiece && selectedStats && (
        <div className="bp-detail">
          <div className="bp-detail__name">
            <GameIcon name="shield" size={16} /> <strong>{selectedPiece}</strong>
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
        <span>Click to place</span>
        <span className="bp-controls__sep">•</span>
        <span>R — Rotate</span>
        <span className="bp-controls__sep">•</span>
        <span>ESC — Cancel</span>
      </div>
    </div>
  );
};
