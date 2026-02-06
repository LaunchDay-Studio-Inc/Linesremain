// ─── Chat Box ───

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import '../../styles/hud.css';

const MAX_VISIBLE = 8;
const FADE_AFTER_MS = 10_000;
const MAX_INPUT_LENGTH = 200;

export const ChatBox: React.FC = () => {
  const messages = useChatStore((s) => s.messages);
  const isOpen = useChatStore((s) => s.isOpen);
  const setOpen = useChatStore((s) => s.setOpen);
  const addMessage = useChatStore((s) => s.addMessage);

  const [input, setInput] = useState('');
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tick `now` periodically so messages fade out automatically
  useEffect(() => {
    if (isOpen) return; // No need to tick when chat is open (all visible)
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Enter key to open chat
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isOpen) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, setOpen]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed.length > 0) {
        addMessage('You', trimmed, 'global');
      }
      setInput('');
      setOpen(false);
    },
    [input, addMessage, setOpen],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        setOpen(false);
      }
    },
    [setOpen],
  );

  const visibleMessages = messages.slice(-MAX_VISIBLE);

  return (
    <div className={`chat-box${isOpen ? ' chat-box--active' : ''}`}>
      <div className="chat-messages">
        {visibleMessages.map((msg) => {
          const age = now - msg.timestamp;
          const faded = !isOpen && age > FADE_AFTER_MS;

          return (
            <div
              key={msg.id}
              className={`chat-message chat-message--${msg.channel}${faded ? ' chat-message--faded' : ''}`}
            >
              {msg.channel !== 'system' && (
                <strong>{msg.sender}: </strong>
              )}
              {msg.message}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {isOpen && (
        <form className="chat-input-wrap" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
            onKeyDown={handleKeyDown}
            maxLength={MAX_INPUT_LENGTH}
          />
        </form>
      )}
    </div>
  );
};