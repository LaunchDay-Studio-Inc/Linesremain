// ─── Leaderboard Panel ───
// Displays server-wide leaderboard with sortable columns.

import React, { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';
import '../../styles/progression.css';

interface LeaderboardEntry {
  username: string;
  level: number;
  xp: number;
  totalKillsNpc: number;
  totalKillsPvp: number;
  totalBuildings: number;
  totalGathered: number;
}

type SortField = 'level' | 'totalKills' | 'totalBuildings' | 'totalGathered';

export const LeaderboardPanel: React.FC = () => {
  const isOpen = useUIStore((s) => s.leaderboardOpen);
  const toggle = useUIStore((s) => s.toggleLeaderboard);
  const accessToken = useGameStore((s) => s.accessToken);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortBy, setSortBy] = useState<SortField>('level');
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?sort=${sortBy}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sortBy, accessToken]);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, fetchLeaderboard]);

  if (!isOpen) return null;

  return (
    <div className="panel-backdrop" onClick={toggle}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 520 }}>
        <div className="panel__header">
          <span className="panel__title">Leaderboard</span>
          <button className="panel__close" onClick={toggle}>
            X
          </button>
        </div>

        {/* Sort tabs */}
        <div className="ach-category-tabs" style={{ marginBottom: 12 }}>
          {(
            [
              ['level', 'Level'],
              ['totalKills', 'Kills'],
              ['totalBuildings', 'Buildings'],
              ['totalGathered', 'Gathered'],
            ] as [SortField, string][]
          ).map(([field, label]) => (
            <button
              key={field}
              className={`ach-tab ${sortBy === field ? 'ach-tab--active' : ''}`}
              onClick={() => setSortBy(field)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Leaderboard table */}
        {loading ? (
          <div className="lb-loading">Loading...</div>
        ) : (
          <div className="lb-table">
            <div className="lb-row lb-row--header">
              <div className="lb-rank">#</div>
              <div className="lb-name">Player</div>
              <div className="lb-stat">Lvl</div>
              <div className="lb-stat">NPC</div>
              <div className="lb-stat">PvP</div>
              <div className="lb-stat">Built</div>
              <div className="lb-stat">Gathered</div>
            </div>
            {entries.map((entry, i) => (
              <div key={entry.username} className="lb-row">
                <div className="lb-rank">{i + 1}</div>
                <div className="lb-name">{entry.username}</div>
                <div className="lb-stat">{entry.level}</div>
                <div className="lb-stat">{entry.totalKillsNpc}</div>
                <div className="lb-stat">{entry.totalKillsPvp}</div>
                <div className="lb-stat">{entry.totalBuildings}</div>
                <div className="lb-stat">{entry.totalGathered}</div>
              </div>
            ))}
            {entries.length === 0 && <div className="lb-empty">No players yet</div>}
          </div>
        )}
      </div>
    </div>
  );
};
