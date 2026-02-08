// ─── Settings Panel ───

import React, { useCallback } from 'react';
import { musicSystem } from '../../engine/MusicSystem';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';

// ─── Shadow Quality Options ───

const SHADOW_OPTIONS = ['off', 'low', 'medium', 'high'] as const;

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

// ─── Settings Panel ───

export const SettingsPanel: React.FC = () => {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const toggleSettings = useUIStore((s) => s.toggleSettings);

  const renderDistance = useSettingsStore((s) => s.renderDistance);
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  const particleDensity = useSettingsStore((s) => s.particleDensity);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const mouseSensitivity = useSettingsStore((s) => s.mouseSensitivity);
  const showFps = useSettingsStore((s) => s.showFps);
  const showPing = useSettingsStore((s) => s.showPing);

  const setRenderDistance = useSettingsStore((s) => s.setRenderDistance);
  const setShadowQuality = useSettingsStore((s) => s.setShadowQuality);
  const setParticleDensity = useSettingsStore((s) => s.setParticleDensity);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setMouseSensitivity = useSettingsStore((s) => s.setMouseSensitivity);
  const setShowFps = useSettingsStore((s) => s.setShowFps);
  const setShowPing = useSettingsStore((s) => s.setShowPing);

  const handleShadowChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setShadowQuality(e.target.value as 'off' | 'low' | 'medium' | 'high');
    },
    [setShadowQuality],
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
          </div>

          {/* Audio */}
          <div className="settings-section">
            <h3 className="settings-section__title">Audio</h3>

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

            <ToggleRow
              label="Music"
              checked={musicEnabled}
              onChange={handleMusicEnabledChange}
            />

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
          </div>

          {/* HUD */}
          <div className="settings-section">
            <h3 className="settings-section__title">HUD</h3>

            <ToggleRow label="Show FPS" checked={showFps} onChange={setShowFps} />
            <ToggleRow label="Show Ping" checked={showPing} onChange={setShowPing} />
          </div>
        </div>
      </div>
    </div>
  );
};
