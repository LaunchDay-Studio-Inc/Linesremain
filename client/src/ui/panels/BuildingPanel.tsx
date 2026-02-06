// ─── Building Panel ───

import { useState, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { BuildingPieceType, BuildingTier } from '@shared/types/buildings';
import { BUILDING_REGISTRY } from '@shared/constants/buildings';
import '../../styles/panels.css';

// ─── Tier Display Names ───

const BUILDING_TIERS: { tier: BuildingTier; label: string }[] = [
  { tier: BuildingTier.Twig, label: 'Twig' },
  { tier: BuildingTier.Wood, label: 'Wood' },
  { tier: BuildingTier.Stone, label: 'Stone' },
  { tier: BuildingTier.Metal, label: 'Metal' },
  { tier: BuildingTier.Armored, label: 'Armored' },
];

// ─── Item Name Lookup (simplified) ───

const ITEM_NAMES: Record<number, string> = {
  1: 'Wood',
  2: 'Stone',
  10: 'Metal Fragments',
  12: 'HQM',
};

// ─── Building Piece Definitions for UI ───

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

export const BuildingPanel: React.FC<BuildingPanelProps> = ({
  onSelectPiece,
  onCancelPreview,
}) => {
  const buildingMode = useUIStore((s) => s.buildingMode);
  const [activeTierIndex, setActiveTierIndex] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState<BuildingPieceType | null>(null);

  const activeTier = BUILDING_TIERS[activeTierIndex]?.tier ?? BuildingTier.Twig;

  const handlePieceClick = useCallback(
    (piece: BuildingPieceUI) => {
      if (selectedPiece === piece.type) {
        // Deselect
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
      // Re-trigger preview with new tier if a piece is selected
      if (selectedPiece) {
        onSelectPiece?.(selectedPiece, newTier);
      }
    },
    [selectedPiece, onSelectPiece],
  );

  if (!buildingMode) return null;

  // Get upgrade costs for selected piece at active tier
  const selectedStats = selectedPiece ? BUILDING_REGISTRY[selectedPiece] : null;
  const upgradeCosts = selectedStats?.upgradeCosts[activeTier] ?? [];
  const healthAtTier = selectedStats?.healthPerTier[activeTier] ?? 0;

  return (
    <div className="building-panel">
      {/* Tier Tabs */}
      <div className="building-tiers">
        {BUILDING_TIERS.map((tier, i) => (
          <button
            key={tier.label}
            className={`building-tier-tab${i === activeTierIndex ? ' building-tier-tab--active' : ''}`}
            onClick={() => handleTierChange(i)}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* Building Pieces */}
      <div className="building-pieces">
        {BUILDING_PIECES.map((piece) => {
          const stats = BUILDING_REGISTRY[piece.type];
          const hp = stats?.healthPerTier[activeTier] ?? 0;
          const isAvailable = hp > 0;

          return (
            <div
              key={piece.type}
              className={`building-piece${selectedPiece === piece.type ? ' building-piece--selected' : ''}${!isAvailable ? ' building-piece--unavailable' : ''}`}
              onClick={() => isAvailable && handlePieceClick(piece)}
              title={isAvailable ? `${piece.label} — ${hp} HP` : `${piece.label} — Not available at this tier`}
            >
              <span className="building-piece__icon">{piece.icon}</span>
              <span className="building-piece__label">{piece.label}</span>
              {isAvailable && <span className="building-piece__hp">{hp} HP</span>}
            </div>
          );
        })}
      </div>

      {/* Material Cost Display */}
      {selectedPiece && (
        <div className="building-cost">
          <div className="building-cost__header">
            <strong>{selectedPiece}</strong> — {BUILDING_TIERS[activeTierIndex]?.label}
          </div>
          <div className="building-cost__hp">Health: {healthAtTier}</div>
          {upgradeCosts.length > 0 ? (
            <div className="building-cost__materials">
              <span className="building-cost__label">Cost:</span>
              {upgradeCosts.map((cost) => (
                <span key={cost.itemId} className="building-cost__item">
                  {ITEM_NAMES[cost.itemId] ?? `Item #${cost.itemId}`} × {cost.quantity}
                </span>
              ))}
            </div>
          ) : (
            <div className="building-cost__materials">
              <span className="building-cost__label">Free (Twig)</span>
            </div>
          )}
        </div>
      )}

      {/* Controls Hint */}
      <div className="building-controls">
        <span>🖱️ Click to place</span>
        <span>R — Rotate</span>
        <span>ESC — Cancel</span>
      </div>
    </div>
  );
};