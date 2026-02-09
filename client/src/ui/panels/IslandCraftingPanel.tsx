// ─── Island Crafting Panel ───
// Crafting panel for the island world, using island-specific recipes.

import {
  ClientMessage,
  ISLAND_RECIPES,
  ITEM_REGISTRY,
  type IslandRecipe,
  type ItemStack,
} from '@lineremain/shared';
import React, { useCallback, useMemo } from 'react';
import { socketClient } from '../../network/SocketClient';
import { useGameStore } from '../../stores/useGameStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useUIStore } from '../../stores/useUIStore';
import type { IconName } from '../common/GameIcon';
import { GameIcon } from '../common/GameIcon';

// ─── Helpers ───

function hasIngredients(
  inventory: (ItemStack | null)[],
  ingredients: Array<{ itemId: number; quantity: number }>,
): boolean {
  for (const ing of ingredients) {
    let count = 0;
    for (const slot of inventory) {
      if (slot && slot.itemId === ing.itemId) count += slot.quantity;
    }
    if (count < ing.quantity) return false;
  }
  return true;
}

function getIngredientCount(inventory: (ItemStack | null)[], itemId: number): number {
  let count = 0;
  for (const slot of inventory) {
    if (slot && slot.itemId === itemId) count += slot.quantity;
  }
  return count;
}

// ─── Styles ───

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 420,
  maxWidth: '100vw',
  background: 'var(--bg-panel, rgba(20,22,28,0.95))',
  borderLeft: '1px solid rgba(240,165,0,0.15)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-ui, Inter), sans-serif',
  color: 'var(--text-primary, #eeeef2)',
  zIndex: 100,
  pointerEvents: 'auto',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid rgba(240,165,0,0.12)',
  flexShrink: 0,
};

const titleContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.5,
  color: 'var(--accent, #f0a500)',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-primary, #eeeef2)',
  fontSize: 18,
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 4px)',
  lineHeight: 1,
  opacity: 0.7,
  transition: 'opacity 0.15s',
};

const gridContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 20px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card, rgba(30,33,40,0.9))',
  borderRadius: 'var(--radius-md, 8px)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  border: '1px solid rgba(255,255,255,0.06)',
  transition: 'border-color 0.15s',
  minWidth: 0,
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const cardNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary, #eeeef2)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const ingredientLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: 'rgba(238,238,242,0.4)',
  marginBottom: 2,
};

const ingredientRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
  padding: '2px 0',
};

const craftButtonBaseStyle: React.CSSProperties = {
  marginTop: 'auto',
  padding: '7px 0',
  border: 'none',
  borderRadius: 'var(--radius-sm, 4px)',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-ui, Inter), sans-serif',
  cursor: 'pointer',
  transition: 'background 0.15s, opacity 0.15s',
  letterSpacing: 0.3,
};

// ─── Recipe Card ───

interface RecipeCardProps {
  recipe: IslandRecipe;
  inventory: (ItemStack | null)[];
  isOffline: boolean;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, inventory, isOffline }) => {
  const canCraft = useMemo(
    () => hasIngredients(inventory, recipe.ingredients),
    [inventory, recipe.ingredients],
  );

  const handleCraft = useCallback(() => {
    if (!canCraft) return;
    if (!isOffline) {
      socketClient.emit(ClientMessage.CraftStart, { recipeId: recipe.id });
    }
  }, [canCraft, isOffline, recipe.id]);

  return (
    <div
      style={{
        ...cardStyle,
        borderColor: canCraft ? 'rgba(240,165,0,0.2)' : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Icon + Name */}
      <div style={cardHeaderStyle}>
        <GameIcon name={recipe.icon as IconName} size={22} color="var(--accent, #f0a500)" />
        <span style={cardNameStyle}>{recipe.name}</span>
      </div>

      {/* Ingredients */}
      <div>
        <div style={ingredientLabelStyle}>Ingredients</div>
        {recipe.ingredients.map((ing) => {
          const def = ITEM_REGISTRY[ing.itemId];
          const have = getIngredientCount(inventory, ing.itemId);
          const enough = have >= ing.quantity;

          return (
            <div key={ing.itemId} style={ingredientRowStyle}>
              <span
                style={{ color: enough ? 'var(--success, #2ecc71)' : 'var(--danger, #e74c3c)' }}
              >
                {def?.name ?? `Item #${ing.itemId}`}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: enough ? 'var(--success, #2ecc71)' : 'var(--danger, #e74c3c)',
                }}
              >
                {have}/{ing.quantity}
              </span>
            </div>
          );
        })}
      </div>

      {/* Craft Button */}
      <button
        style={{
          ...craftButtonBaseStyle,
          background: canCraft ? 'var(--accent, #f0a500)' : 'rgba(255,255,255,0.08)',
          color: canCraft ? '#111' : 'rgba(238,238,242,0.3)',
          opacity: canCraft ? 1 : 0.6,
          cursor: canCraft ? 'pointer' : 'default',
        }}
        disabled={!canCraft}
        onClick={handleCraft}
      >
        Craft
      </button>
    </div>
  );
};

// ─── Island Crafting Panel ───

export const IslandCraftingPanel: React.FC = () => {
  const craftingOpen = useUIStore((s) => s.craftingOpen);
  const toggleCrafting = useUIStore((s) => s.toggleCrafting);
  const playerWorld = useGameStore((s) => s.playerWorld);
  const isOffline = useGameStore((s) => s.isOffline);
  const inventory = usePlayerStore((s) => s.inventory);

  // Only render when crafting is open AND we are in the island world (or offline)
  if (!craftingOpen) return null;
  if (playerWorld !== 'islands' && !isOffline) return null;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleContainerStyle}>
          <GameIcon name="fire-pit" size={22} color="var(--accent, #f0a500)" />
          <span style={titleStyle}>Island Crafting</span>
        </div>
        <button
          style={closeButtonStyle}
          onClick={toggleCrafting}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
          }}
        >
          &#x2715;
        </button>
      </div>

      {/* Recipe Grid */}
      <div style={gridContainerStyle}>
        <div style={gridStyle}>
          {ISLAND_RECIPES.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              inventory={inventory}
              isOffline={isOffline}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
