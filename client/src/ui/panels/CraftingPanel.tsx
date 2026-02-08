// ─── Crafting Panel ───

import { ITEM_REGISTRY } from '@shared/constants/items';
import { RECIPE_REGISTRY } from '@shared/constants/recipes';
import type { CraftProgressPayload } from '@shared/types/network';
import { ServerMessage } from '@shared/types/network';
import type { RecipeDefinition } from '@shared/types/recipes';
import { CraftingTier } from '@shared/types/recipes';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { socketClient } from '../../network/SocketClient';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';
import { getItemIconName } from '../../utils/itemIcons';
import { GameIcon } from '../common/GameIcon';

const TIER_LABELS: Record<number, string> = {
  [CraftingTier.Primitive]: 'Primitive',
  [CraftingTier.Intermediate]: 'Intermediate',
  [CraftingTier.Advanced]: 'Advanced',
  [CraftingTier.Military]: 'Military',
};

export const CraftingPanel: React.FC = () => {
  const craftingOpen = useUIStore((s) => s.craftingOpen);
  const toggleCrafting = useUIStore((s) => s.toggleCrafting);

  if (!craftingOpen) return null;

  return (
    <div className="panel-backdrop" onClick={toggleCrafting}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel__header">
          <span className="panel__title">Crafting</span>
          <button className="panel__close" onClick={toggleCrafting}>
            ✕
          </button>
        </div>
        <CraftingContent />
      </div>
    </div>
  );
};

// ─── Crafting Content ───

const CraftingContent: React.FC = () => {
  const inventory = usePlayerStore((s) => s.inventory);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [craftProgress, setCraftProgress] = useState<{ recipeId: number; progress: number } | null>(
    null,
  );

  // Listen for craft progress updates from server
  useEffect(() => {
    const handler = (data: unknown) => {
      const payload = data as CraftProgressPayload;
      if (payload.isComplete) {
        setCraftProgress(null);
      } else {
        setCraftProgress({ recipeId: payload.recipeId, progress: payload.progress });
      }
    };
    socketClient.on(ServerMessage.CraftProgress, handler);
    return () => socketClient.off(ServerMessage.CraftProgress, handler);
  }, []);

  // Build recipes array from registry
  const allRecipes = useMemo(() => {
    return Object.values(RECIPE_REGISTRY) as RecipeDefinition[];
  }, []);

  // Filter recipes by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allRecipes;
    const q = search.toLowerCase();
    return allRecipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [allRecipes, search]);

  // Group by tier
  const grouped = useMemo(() => {
    const map = new Map<number, RecipeDefinition[]>();
    for (const recipe of filtered) {
      const list = map.get(recipe.tier) ?? [];
      list.push(recipe);
      map.set(recipe.tier, list);
    }
    return map;
  }, [filtered]);

  // Count player items for ingredient checking
  const itemCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const slot of inventory) {
      if (slot) {
        counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + slot.quantity);
      }
    }
    return counts;
  }, [inventory]);

  const selectedRecipe =
    selectedId != null ? (allRecipes.find((r) => r.id === selectedId) ?? null) : null;

  const canCraft = selectedRecipe
    ? selectedRecipe.ingredients.every((ing) => (itemCounts.get(ing.itemId) ?? 0) >= ing.quantity)
    : false;

  const handleCraft = useCallback(() => {
    if (!selectedRecipe || !canCraft) return;
    socketClient.emit('c:craft_start', { recipeId: selectedRecipe.id });
  }, [selectedRecipe, canCraft]);

  return (
    <div className="crafting-layout">
      {/* Recipe List */}
      <div className="crafting-list">
        <input
          className="crafting-search"
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {[
          CraftingTier.Primitive,
          CraftingTier.Intermediate,
          CraftingTier.Advanced,
          CraftingTier.Military,
        ].map((tier) => {
          const recipes = grouped.get(tier);
          if (!recipes || recipes.length === 0) return null;

          return (
            <div key={tier}>
              <div className="crafting-tier-header">{TIER_LABELS[tier]}</div>
              {recipes.map((recipe) => {
                const outputDef = ITEM_REGISTRY[recipe.outputItemId];
                const hasAll = recipe.ingredients.every(
                  (ing) => (itemCounts.get(ing.itemId) ?? 0) >= ing.quantity,
                );

                return (
                  <div
                    key={recipe.id}
                    className={`crafting-recipe${selectedId === recipe.id ? ' crafting-recipe--selected' : ''}${!hasAll ? ' crafting-recipe--unavailable' : ''}`}
                    onClick={() => setSelectedId(recipe.id)}
                  >
                    <span className="crafting-recipe__icon">
                      <GameIcon
                        name={getItemIconName(recipe.outputItemId, outputDef?.category)}
                        size={18}
                      />
                    </span>
                    <span className="crafting-recipe__name">{recipe.name}</span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Active craft queue indicator */}
        {craftProgress && (
          <div className="craft-queue" style={{ marginTop: 8 }}>
            <div
              className="craft-queue__item"
              onClick={() => setSelectedId(craftProgress.recipeId)}
            >
              {(() => {
                const recipe = RECIPE_REGISTRY[craftProgress.recipeId] as
                  | RecipeDefinition
                  | undefined;
                const outputDef = recipe ? ITEM_REGISTRY[recipe.outputItemId] : undefined;
                return outputDef && recipe ? (
                  <GameIcon
                    name={getItemIconName(recipe.outputItemId, outputDef.category)}
                    size={18}
                  />
                ) : (
                  '?'
                );
              })()}
              <div
                className="craft-queue__progress"
                style={{ width: `${craftProgress.progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Recipe Detail */}
      <div className="crafting-detail">
        {selectedRecipe ? (
          <>
            <div className="crafting-detail__name">{selectedRecipe.name}</div>
            <div className="crafting-detail__desc">
              {TIER_LABELS[selectedRecipe.tier]} · {selectedRecipe.craftTimeSeconds}s craft time
              {selectedRecipe.requiredStation && ` · Requires ${selectedRecipe.requiredStation}`}
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Ingredients
              </div>
              {selectedRecipe.ingredients.map((ing, i) => {
                const ingDef = ITEM_REGISTRY[ing.itemId];
                const have = itemCounts.get(ing.itemId) ?? 0;
                const enough = have >= ing.quantity;

                return (
                  <div
                    key={i}
                    className={`crafting-ingredient ${enough ? 'crafting-ingredient--has' : 'crafting-ingredient--missing'}`}
                  >
                    <span>{ingDef?.name ?? `Item #${ing.itemId}`}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
                      {have}/{ing.quantity}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Output
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {ITEM_REGISTRY[selectedRecipe.outputItemId]?.name ?? 'Unknown'} ×
                {selectedRecipe.outputQuantity}
              </div>
            </div>

            <button
              className="craft-btn"
              disabled={!canCraft || craftProgress !== null}
              onClick={handleCraft}
            >
              {craftProgress && craftProgress.recipeId === selectedRecipe.id
                ? `Crafting... ${Math.round(craftProgress.progress * 100)}%`
                : 'Craft'}
            </button>

            {/* Craft progress bar */}
            {craftProgress && craftProgress.recipeId === selectedRecipe.id && (
              <div style={{ marginTop: 8 }}>
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{
                      width: `${craftProgress.progress * 100}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            Select a recipe
          </div>
        )}
      </div>
    </div>
  );
};
