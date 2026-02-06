// ─── Team Panel ───

import React from 'react';
import { Button } from '../common/Button';
import '../../styles/panels.css';

interface TeamMember {
  id: string;
  name: string;
  role: 'leader' | 'member';
  online: boolean;
}

interface TeamPanelProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string | null;
  members: TeamMember[];
  onCreateTeam?: () => void;
  onLeaveTeam?: () => void;
  onKickMember?: (memberId: string) => void;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
  isOpen,
  onClose,
  teamName,
  members,
  onCreateTeam,
  onLeaveTeam,
  onKickMember,
}) => {
  if (!isOpen) return null;

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel team-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel__header">
          <span className="panel__title">{teamName ?? 'Team'}</span>
          <button className="panel__close" onClick={onClose}>✕</button>
        </div>

        {teamName ? (
          <>
            {/* Member List */}
            <div style={{ marginBottom: 16 }}>
              {members.map((member) => (
                <div key={member.id} className="team-member">
                  <div
                    className={`team-member__status team-member__status--${member.online ? 'online' : 'offline'}`}
                  />
                  <span className="team-member__name">{member.name}</span>
                  <span className="team-member__role">{member.role}</span>
                  {onKickMember && member.role !== 'leader' && (
                    <Button
                      variant="danger"
                      onClick={() => onKickMember(member.id)}
                    >
                      Kick
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="team-actions">
              {onLeaveTeam && (
                <Button variant="danger" onClick={onLeaveTeam}>
                  Leave Team
                </Button>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '24px 0',
            }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              You are not in a team.
            </div>
            {onCreateTeam && (
              <Button variant="primary" onClick={onCreateTeam}>
                Create Team
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};