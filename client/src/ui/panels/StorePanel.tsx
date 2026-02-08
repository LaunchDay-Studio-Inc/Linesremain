// ─── Store Panel ───
// Cosmetic store with grid layout and category filters.

import { DEFAULT_STORE_ITEMS } from '@shared/constants/monetization';
import type { StoreCategory } from '@shared/types/monetization';
import React, { useState } from 'react';

const CATEGORIES: { id: StoreCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'skin', label: 'Skins' },
  { id: 'trail', label: 'Trails' },
  { id: 'death_effect', label: 'Effects' },
  { id: 'accessory', label: 'Accessories' },
];

interface StorePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorePanel: React.FC<StorePanelProps> = ({ isOpen, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<StoreCategory | 'all'>('all');
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredItems =
    selectedCategory === 'all'
      ? DEFAULT_STORE_ITEMS
      : DEFAULT_STORE_ITEMS.filter((item) => item.category === selectedCategory);

  const handleBuy = (itemName: string) => {
    setPurchaseMessage(
      `Payment integration coming soon! "${itemName}" will be available for purchase.`,
    );
    setTimeout(() => setPurchaseMessage(null), 3000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        zIndex: 2000,
        fontFamily: 'var(--font-ui)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 100%)',
          border: '1px solid rgba(240,165,0,0.2)',
          borderRadius: '12px',
          width: '700px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '3px',
              margin: 0,
              background: 'linear-gradient(180deg, #F0A500, #FF6B35)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            STORE
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            x
          </button>
        </div>

        {/* Category tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: selectedCategory === cat.id ? 'rgba(240,165,0,0.2)' : 'transparent',
                color: selectedCategory === cat.id ? '#F0A500' : 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Purchase message */}
        {purchaseMessage && (
          <div
            style={{
              margin: '12px 24px 0',
              padding: '10px 16px',
              background: 'rgba(46,204,113,0.15)',
              border: '1px solid rgba(46,204,113,0.3)',
              borderRadius: '6px',
              color: '#2ECC71',
              fontSize: '13px',
            }}
          >
            {purchaseMessage}
          </div>
        )}

        {/* Item grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            padding: '16px 24px 24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Preview swatch */}
              <div
                style={{
                  width: '100%',
                  height: '60px',
                  borderRadius: '6px',
                  background: Object.values(item.previewData)[0] || '#555',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '4px',
                    height: '32px',
                    background: 'rgba(255,255,255,0.8)',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px rgba(255,255,255,0.3)',
                  }}
                />
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                {item.name}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
                {item.description}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 'auto',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#F0A500' }}>
                  ${(item.priceCents / 100).toFixed(2)}
                </span>
                <button
                  onClick={() => handleBuy(item.name)}
                  style={{
                    padding: '6px 14px',
                    background: 'linear-gradient(135deg, #F0A500, #E09400)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#0A0A14',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  BUY
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.2)',
              margin: 0,
              letterSpacing: '1px',
            }}
          >
            ALL ITEMS ARE COSMETIC ONLY — NO GAMEPLAY ADVANTAGES
          </p>
        </div>
      </div>
    </div>
  );
};
