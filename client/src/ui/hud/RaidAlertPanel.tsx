import { useEffect, useState } from 'react';
import { useEndgameStore } from '../../stores/useEndgameStore';

export function RaidAlertPanel() {
  const raidAlert = useEndgameStore((s) => s.raidAlert);
  const setRaidAlert = useEndgameStore((s) => s.setRaidAlert);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (raidAlert) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setRaidAlert(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [raidAlert, setRaidAlert]);

  if (!visible || !raidAlert) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(180, 20, 20, 0.9)',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '4px',
        border: '2px solid #ff4444',
        fontSize: '18px',
        fontWeight: 'bold',
        textAlign: 'center',
        zIndex: 1000,
        animation: 'pulse 1s infinite',
        pointerEvents: 'none',
      }}
    >
      <div>BASE UNDER ATTACK!</div>
      <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '4px' }}>
        Position: ({Math.round(raidAlert.position.x)}, {Math.round(raidAlert.position.z)})
      </div>
    </div>
  );
}
