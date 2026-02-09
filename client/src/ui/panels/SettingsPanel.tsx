// ─── Settings Panel ───

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { KeybindMap } from '../../engine/InputManager';
import { musicSystem } from '../../engine/MusicSystem';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';

// ─── Shadow Quality Options ───

const SHADOW_OPTIONS = ['off', 'low', 'medium', 'high'] as const;

// ─── Max FPS Options ───

const FPS_OPTIONS = [
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 120, label: '120' },
  { value: 144, label: '144' },
  { value: 0, label: 'Unlimited' },
] as const;

// ─── Keybind Display Names ───

const KEYBIND_LABELS: Record<keyof KeybindMap, string> = {
  moveForward: 'Move Forward',
  moveBackward: 'Move Backward',
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  jump: 'Jump',
  sprint: 'Sprint',
  crouch: 'Crouch',
  gather: 'Gather',
  attack: 'Attack / Interact',
  interact: 'Interact / Open',
  inventory: 'Inventory',
  chat: 'Chat',
  map: 'Map',
  buildMode: 'Build Mode',
  dropItem: 'Drop Item',
  reload: 'Reload',
};

/** Convert a KeyboardEvent.code to a short readable name. */
function friendlyKeyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code === 'Tab') return 'Tab';
  if (code === 'Enter') return 'Enter';
  if (code === 'Escape') return 'Esc';
  if (code === 'Backspace') return 'Bksp';
  if (code.startsWith('Arrow')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

// ─── Slider Row Component ───

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, displayValue, onChange }) => (
  <div className="settings-row">
    <label className="settings-label">{label}</label>
    <div className="settings-control">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="settings-slider"
      />
      <span className="settings-value">{displayValue ?? value}</span>
    </div>
  </div>
);

// ─── Toggle Row Component ───

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <div className="settings-row">
    <label className="settings-label">{label}</label>
    <div className="settings-control">
      <button
        className={`settings-toggle ${checked ? 'settings-toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        {checked ? 'ON' : 'OFF'}
      </button>
    </div>
  </div>
);

// ─── Keybind Row Component ───

const KeybindRow: React.FC<{
  label: string;
  code: string;
  onRebind: (newCode: string) => void;
}> = ({ label, code, onRebind }) => {
  const [listening, setListening] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!listening) return;

    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListening(false);
        return;
      }
      onRebind(e.code);
      setListening(false);
    };

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [listening, onRebind]);

  return (
    <div className="settings-row">
      <label className="settings-label">{label}</label>
      <div className="settings-control">
        <button
          ref={btnRef}
          className={`settings-keybind ${listening ? 'settings-keybind--listening' : ''}`}
          onClick={() => setListening(true)}
        >
          {listening ? 'Press a key...' : friendlyKeyName(code)}
        </button>
      </div>
    </div>
  );
};

// ─── Settings Panel ───

export const SettingsPanel: React.FC = () => {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const toggleSettings = useUIStore((s) => s.toggleSettings);

  // Graphics
  const renderDistance = useSettingsStore((s) => s.renderDistance);
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  const particleDensity = useSettingsStore((s) => s.particleDensity);
  const fov = useSettingsStore((s) => s.fov);
  const maxFps = useSettingsStore((s) => s.maxFps);

  // Audio
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const muteAll = useSettingsStore((s) => s.muteAll);

  // Controls
  const mouseSensitivity = useSettingsStore((s) => s.mouseSensitivity);
  const invertY = useSettingsStore((s) => s.invertY);
  const keybinds = useSettingsStore((s) => s.keybinds);

  // HUD & Gameplay
  const showFps = useSettingsStore((s) => s.showFps);
  const showPing = useSettingsStore((s) => s.showPing);
  const showDebug = useSettingsStore((s) => s.showDebug);
  const chatOpacity = useSettingsStore((s) => s.chatOpacity);
  const showTutorial = useSettingsStore((s) => s.showTutorial);

  // Setters
  const setRenderDistance = useSettingsStore((s) => s.setRenderDistance);
  const setShadowQuality = useSettingsStore((s) => s.setShadowQuality);
  const setParticleDensity = useSettingsStore((s) => s.setParticleDensity);
  const setFov = useSettingsStore((s) => s.setFov);
  const setMaxFps = useSettingsStore((s) => s.setMaxFps);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setMuteAll = useSettingsStore((s) => s.setMuteAll);
  const setMouseSensitivity = useSettingsStore((s) => s.setMouseSensitivity);
  const setInvertY = useSettingsStore((s) => s.setInvertY);
  const setKeybind = useSettingsStore((s) => s.setKeybind);
  const resetKeybinds = useSettingsStore((s) => s.resetKeybinds);
  const setShowFps = useSettingsStore((s) => s.setShowFps);
  const setShowPing = useSettingsStore((s) => s.setShowPing);
  const setShowDebug = useSettingsStore((s) => s.setShowDebug);
  const setChatOpacity = useSettingsStore((s) => s.setChatOpacity);
  const setShowTutorial = useSettingsStore((s) => s.setShowTutorial);

  const handleShadowChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setShadowQuality(e.target.value as 'off' | 'low' | 'medium' | 'high');
    },
    [setShadowQuality],
  );

  const handleMaxFpsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setMaxFps(Number(e.target.value));
    },
    [setMaxFps],
  );

  const handleMusicVolumeChange = useCallback(
    (v: number) => {
      setMusicVolume(v);
      musicSystem.setVolume(v / 100);
    },
    [setMusicVolume],
  );

  const handleMusicEnabledChange = useCallback(
    (v: boolean) => {
      setMusicEnabled(v);
      musicSystem.setEnabled(v);
    },
    [setMusicEnabled],
  );

  if (!settingsOpen) return null;

  return (
    <div className="panel-backdrop" onClick={toggleSettings}>
      <div className="panel settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel__header">
          <span className="panel__title">Settings</span>
          <button className="panel__close" onClick={toggleSettings}>
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* Graphics */}
          <div className="settings-section">
            <h3 className="settings-section__title">Graphics</h3>

            <SliderRow
              label="Render Distance"
              value={renderDistance}
              min={3}
              max={10}
              step={1}
              displayValue={`${renderDistance} chunks`}
              onChange={setRenderDistance}
            />

            <div className="settings-row">
              <label className="settings-label">Shadow Quality</label>
              <div className="settings-control">
                <select
                  className="settings-select"
                  value={shadowQuality}
                  onChange={handleShadowChange}
                >
                  {SHADOW_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <SliderRow
              label="Particle Density"
              value={particleDensity}
              min={0}
              max={100}
              step={5}
              displayValue={`${particleDensity}%`}
              onChange={setParticleDensity}
            />

            <SliderRow
              label="Field of View"
              value={fov}
              min={50}
              max={120}
              step={5}
              displayValue={`${fov}°`}
              onChange={setFov}
            />

            <div className="settings-row">
              <label className="settings-label">Max FPS</label>
              <div className="settings-control">
                <select className="settings-select" value={maxFps} onChange={handleMaxFpsChange}>
                  {FPS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Audio */}
          <div className="settings-section">
            <h3 className="settings-section__title">Audio</h3>

            <ToggleRow label="Mute All" checked={muteAll} onChange={setMuteAll} />

            <SliderRow
              label="Master Volume"
              value={masterVolume}
              min={0}
              max={100}
              step={1}
              displayValue={`${masterVolume}%`}
              onChange={setMasterVolume}
            />

            <SliderRow
              label="SFX Volume"
              value={sfxVolume}
              min={0}
              max={100}
              step={1}
              displayValue={`${sfxVolume}%`}
              onChange={setSfxVolume}
            />

            <ToggleRow label="Music" checked={musicEnabled} onChange={handleMusicEnabledChange} />

            <SliderRow
              label="Music Volume"
              value={musicVolume}
              min={0}
              max={100}
              step={1}
              displayValue={`${musicVolume}%`}
              onChange={handleMusicVolumeChange}
            />
          </div>

          {/* Controls */}
          <div className="settings-section">
            <h3 className="settings-section__title">Controls</h3>

            <SliderRow
              label="Mouse Sensitivity"
              value={mouseSensitivity}
              min={0.1}
              max={3.0}
              step={0.1}
              displayValue={mouseSensitivity.toFixed(1)}
              onChange={setMouseSensitivity}
            />

            <ToggleRow label="Invert Y Axis" checked={invertY} onChange={setInvertY} />

            <div style={{ marginTop: '12px', marginBottom: '8px' }}>
              <p className="settings-section__title">Keybinds</p>

              {(Object.keys(KEYBIND_LABELS) as (keyof KeybindMap)[]).map((action) => (
                <KeybindRow
                  key={action}
                  label={KEYBIND_LABELS[action]}
                  code={keybinds[action]}
                  onRebind={(newCode) => setKeybind(action, newCode)}
                />
              ))}

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn--secondary"
                  style={{ fontSize: '11px', padding: '6px 14px' }}
                  onClick={resetKeybinds}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>

          {/* HUD & Gameplay */}
          <div className="settings-section">
            <h3 className="settings-section__title">HUD & Gameplay</h3>

            <ToggleRow label="Show FPS" checked={showFps} onChange={setShowFps} />
            <ToggleRow label="Show Ping" checked={showPing} onChange={setShowPing} />
            <ToggleRow label="Show Tutorial" checked={showTutorial} onChange={setShowTutorial} />

            <SliderRow
              label="Chat Opacity"
              value={chatOpacity}
              min={0}
              max={100}
              step={5}
              displayValue={`${chatOpacity}%`}
              onChange={setChatOpacity}
            />
          </div>

          {/* Debug */}
          <div className="settings-section">
            <h3 className="settings-section__title">Debug</h3>

            <ToggleRow label="Show Debug Info" checked={showDebug} onChange={setShowDebug} />
          </div>
        </div>
      </div>
    </div>
  );
};
