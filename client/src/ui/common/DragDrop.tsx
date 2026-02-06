// ─── Drag & Drop Context ───

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ItemStack } from '@shared/types/items';
import { ITEM_REGISTRY } from '@shared/constants/items';
import '../../styles/panels.css';

interface DragState {
  isDragging: boolean;
  draggedItem: ItemStack | null;
  sourceSlot: number;
  sourceType: 'inventory' | 'equipment' | 'container' | 'hotbar';
  mouseX: number;
  mouseY: number;
}

interface DragContextValue {
  dragState: DragState;
  startDrag: (item: ItemStack, slotIndex: number, sourceType: DragState['sourceType'], e: React.MouseEvent) => void;
  endDrag: () => void;
  updatePosition: (e: React.MouseEvent) => void;
}

const defaultDragState: DragState = {
  isDragging: false,
  draggedItem: null,
  sourceSlot: -1,
  sourceType: 'inventory',
  mouseX: 0,
  mouseY: 0,
};

const DragContext = createContext<DragContextValue>({
  dragState: defaultDragState,
  startDrag: () => {},
  endDrag: () => {},
  updatePosition: () => {},
});

export const useDragDrop = () => useContext(DragContext);

interface DragDropProviderProps {
  children: React.ReactNode;
  onDrop?: (sourceSlot: number, targetSlot: number, sourceType: DragState['sourceType'], targetType: DragState['sourceType']) => void;
}

export const DragDropProvider: React.FC<DragDropProviderProps> = ({ children, onDrop }) => {
  const [dragState, setDragState] = useState<DragState>(defaultDragState);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const startDrag = useCallback(
    (item: ItemStack, slotIndex: number, sourceType: DragState['sourceType'], e: React.MouseEvent) => {
      setDragState({
        isDragging: true,
        draggedItem: item,
        sourceSlot: slotIndex,
        sourceType,
        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    },
    [],
  );

  const endDrag = useCallback(() => {
    setDragState(defaultDragState);
  }, []);

  const updatePosition = useCallback((e: React.MouseEvent) => {
    setDragState((s) => (s.isDragging ? { ...s, mouseX: e.clientX, mouseY: e.clientY } : s));
  }, []);

  return (
    <DragContext.Provider value={{ dragState, startDrag, endDrag, updatePosition }}>
      {children}
      {dragState.isDragging && dragState.draggedItem && (
        <DragFloat item={dragState.draggedItem} x={dragState.mouseX} y={dragState.mouseY} />
      )}
    </DragContext.Provider>
  );
};

// ─── Floating Drag Item ───

const DragFloat: React.FC<{ item: ItemStack; x: number; y: number }> = ({ item, x, y }) => {
  const def = ITEM_REGISTRY[item.itemId];
  const label = def ? def.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="drag-float" style={{ left: x, top: y }}>
      <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)' }}>{label}</span>
    </div>
  );
};
