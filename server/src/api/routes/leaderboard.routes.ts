// ─── Leaderboard API Routes ───

import { Router } from 'express';
import { achievementRepository } from '../../database/repositories/AchievementRepository.js';

const router = Router();

// GET /api/leaderboard?sort=totalKills|totalPlaytimeSeconds|level|totalBuildings
router.get('/', async (req, res, next) => {
  try {
    const sortParam = (req.query['sort'] as string) ?? 'level';
    const validSorts = ['totalKills', 'totalPlaytimeSeconds', 'level', 'totalBuildings'] as const;
    const sort = validSorts.includes(sortParam as (typeof validSorts)[number])
      ? (sortParam as (typeof validSorts)[number])
      : 'level';

    const leaderboard = await achievementRepository.getLeaderboard(sort, 25);
    res.json({ entries: leaderboard, sortedBy: sort });
  } catch (err) {
    next(err);
  }
});

// GET /api/player/:username/profile
router.get('/player/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username || username.length < 1) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const profile = await achievementRepository.getPlayerProfile(username);
    if (!profile) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    res.json({
      username: profile.username,
      level: profile.level,
      xp: profile.xp,
      achievements: profile.achievements,
      stats: {
        totalKills: profile.totalKills,
        totalDeaths: profile.totalDeaths,
        totalPlaytime: profile.totalPlaytimeSeconds,
        totalGathered: profile.totalGathered,
        totalCrafted: profile.totalCrafted,
        totalBuildings: profile.totalBuildings,
        biomesVisited: profile.biomesVisited,
        journalsFound: profile.journalsFound,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const leaderboardRouter = router;
