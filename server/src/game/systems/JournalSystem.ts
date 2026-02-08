// ─── Journal System ───
// Tracks journal fragment discovery per player.

import { logger } from '../../utils/logger.js';
import type { GameWorld } from '../World.js';

// ─── State ───

/** Map of playerId -> set of discovered journal fragment IDs */
const discoveredJournals = new Map<string, Set<number>>();

/** Pending journal discoveries to broadcast */
const pendingJournalFinds: Array<{
  playerId: string;
  fragmentId: number;
  title: string;
  text: string;
}> = [];

// Journal fragment texts (keyed by item ID 68-87)
const JOURNAL_TEXTS: Record<number, { title: string; text: string }> = {
  68: {
    title: 'Day 1',
    text: 'The line holds. We built the wall higher today. Every block of stone is another day we survive.',
  },
  69: {
    title: 'Day 14',
    text: 'They come every night now. The husks never tire. We take shifts on the wall, two hours each.',
  },
  70: {
    title: 'Day 23',
    text: 'Lost two more. Maria says we should abandon the east tower. I told her we hold everything or we hold nothing.',
  },
  71: {
    title: 'Day 31',
    text: 'The blood moon rose again. Fourth time. They brought something new — red ones, faster, harder to kill.',
  },
  72: {
    title: 'Day 40',
    text: 'Found the old supply cache in the forest. Enough ammo for a week if we are careful.',
  },
  73: {
    title: 'Day 45',
    text: 'The fog rolled in thick today. Could barely see the wall from the tower. Three got past us.',
  },
  74: {
    title: 'Day 52',
    text: 'The cold ones appeared in the northern peaks. Blue eyes in the blizzard. They hunt in packs.',
  },
  75: {
    title: 'Day 58',
    text: 'They breached the western section. We held, barely. Patched it with whatever stone we had left.',
  },
  76: {
    title: 'Day 63',
    text: 'Lit a signal fire on the tower. No one came. Are we the last ones?',
  },
  77: {
    title: 'Day 70',
    text: 'Three camps spotted to the south. Others survived. We are not alone.',
  },
  78: {
    title: 'Day 75',
    text: 'The swamp creatures are the worst. You can hear them clicking before you see them in the mist.',
  },
  79: {
    title: 'Day 82',
    text: 'Found an old armory past the ridge. The metal doors still hold. Enough weapons to arm everyone.',
  },
  80: {
    title: 'Day 89',
    text: "The dust hoppers are friendly if you don't startle them. The children have started feeding them.",
  },
  81: {
    title: 'Day 94',
    text: 'Mapped the safe routes between the camps. North through the forest, south along the ridge.',
  },
  82: {
    title: 'Day 100',
    text: 'Centennial. Still standing. We carved the words into the wall: THE LINE REMAINS.',
  },
  83: {
    title: 'Day 107',
    text: 'Established trade with the harbor settlement. They have fish, we have metal. Fair exchange.',
  },
  84: {
    title: 'Day 115',
    text: 'The brutes grow larger. Something is changing them. The blood moons make them stronger.',
  },
  85: {
    title: 'Day 120',
    text: 'Recording everything for those who come after. Someone should know what happened here.',
  },
  86: {
    title: 'Day 130',
    text: 'If you find this, know that we tried. We held the line. Every night, every storm, every blood moon.',
  },
  87: {
    title: 'Day 142',
    text: 'This is the last entry. The wall stands. Someone must continue what we started. The line remains.',
  },
};

// ─── System ───

export function journalSystem(_world: GameWorld, _dt: number): void {
  // Journal system is event-driven, not tick-driven
  // Processing happens when items are picked up
}

// ─── API ───

export function onJournalPickup(playerId: string, itemId: number): void {
  if (itemId < 68 || itemId > 87) return;

  if (!discoveredJournals.has(playerId)) {
    discoveredJournals.set(playerId, new Set());
  }

  const discovered = discoveredJournals.get(playerId)!;
  if (discovered.has(itemId)) return; // Already found

  discovered.add(itemId);

  const journal = JOURNAL_TEXTS[itemId];
  if (journal) {
    pendingJournalFinds.push({
      playerId,
      fragmentId: itemId,
      title: journal.title,
      text: journal.text,
    });
    logger.info(
      { playerId, fragmentId: itemId, title: journal.title },
      'Journal fragment discovered',
    );
  }
}

export function drainJournalFinds(): Array<{
  playerId: string;
  fragmentId: number;
  title: string;
  text: string;
}> {
  const finds = [...pendingJournalFinds];
  pendingJournalFinds.length = 0;
  return finds;
}

export function getDiscoveredCount(playerId: string): number {
  return discoveredJournals.get(playerId)?.size ?? 0;
}
