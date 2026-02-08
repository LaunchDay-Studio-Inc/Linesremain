import { useEffect, useState } from 'react';
import { useEndgameStore } from '../../stores/useEndgameStore';

export function WipeWarningHUD() {
  const wipeWarning = useEndgameStore((s) => s.wipeWarning);
  const setWipeWarning = useEndgameStore((s) => s.setWipeWarning);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wipeWarning) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setWipeWarning(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [wipeWarning, setWipeWarning]);

  if (!visible || !wipeWarning) return null;

  const timeStr =
    wipeWarning.timeRemainingMs > 3600000
      ? `${Math.round(wipeWarning.timeRemainingMs / 3600000)}h`
      : `${Math.round(wipeWarning.timeRemainingMs / 60000)}m`;

  return (
    <div
      style={{
        position: 'absolute',
        top: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(200, 150, 0, 0.9)',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '4px',
        border: '2px solid #ffaa00',
        fontSize: '16px',
        fontWeight: 'bold',
        textAlign: 'center',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <div>SERVER WIPE IN {timeStr}</div>
      <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '4px' }}>
        {wipeWarning.message}
      </div>
    </div>
  );
}
