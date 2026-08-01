// src/client/game/bridge.ts
// ─────────────────────────────────────────────────────────────
// Money bridge for PitchKickGame (open-soccer engine).
// Attaches to the running PitchKickGame instance and fires
// callbacks when goals are scored and when the match ends.
//
// NOW CONFIRMED from engine.ts line 3398:
//   - Engine is class PitchKickGame
//   - this.homeScore / this.awayScore track goals
//   - this.celebration > 0 = goal just happened
//   - this.ball.z exists (3D ball with height)
//   - this.freeze pauses the match
// ─────────────────────────────────────────────────────────────

export interface MatchCallbacks {
  onGoal?:     (team: 'home' | 'away', score: { home: number; away: number }) => void;
  onMatchEnd?: (result: {
    winner:          'home' | 'away' | 'draw';
    score:           { home: number; away: number };
    durationSeconds: number;
  }) => void;
}

export interface BridgeHandle {
  destroy: () => void;
}

// PitchKickGame exposes at minimum these public/accessible members
// (we read them via bracket notation to avoid TS private errors)
interface PitchKickGameRef {
  getHomeScore(): number;
  getAwayScore(): number;
  stop():void;
  /**celebration: number;
  freeze:      number;
  practice:    boolean;*/
  // The engine may expose remaining time — we check common names:
  // clock, timeLeft, matchTime, secondsLeft, elapsed
  [key: string]: any;
}

export function attachBridge(
  game:         PitchKickGameRef,
  totalSeconds: number,         // match duration — 7 * 60 = 420 for 7-min arcade
  callbacks:    MatchCallbacks,
): BridgeHandle {
  let lastHome     = 0;
  let lastAway     = 0;
  let matchEnded   = false;
  const startMs    = Date.now();

  // Detect which property holds remaining time
  // (we'll find the right one on first poll)
  let timeKey: string | null = null;

  const iv = setInterval(() => {
    if (matchEnded) return;

    const home = game.getHomeScore();
    const away = game.getAwayScore();

    // ── Detect goal ───────────────────────────────────────────
    if (home !== lastHome) {
      lastHome = home;
      callbacks.onGoal?.('home', { home, away });
    }
    if (away !== lastAway) {
      lastAway = away;
      callbacks.onGoal?.('away', { home, away });
    }

    // ── Find time key once ────────────────────────────────────
    if (!timeKey) {
      const candidates = [
        'clock', 'timeLeft', 'matchTime', 'secondsLeft',
        'elapsed', 'time', 'matchClock', 'gameClock',
        'remainingTime', 'timer',
      ];
      for (const k of candidates) {
        if (typeof game[k] === 'number') {
          timeKey = k;
          break;
        }
      }
    }

    // ── Detect match end ──────────────────────────────────────
    let ended = false;

    if (timeKey) {
      const t = game[timeKey];
      // Handle both "seconds elapsed" and "seconds remaining"
      const isRemaining = timeKey.includes('Left') || timeKey.includes('remain') || timeKey.includes('left');
      if (isRemaining && t <= 0)  ended = true;
      if (!isRemaining && t >= totalSeconds) ended = true;
    } else {
      // Fallback: use wall clock
      const elapsed = (Date.now() - startMs) / 1000;
      if (elapsed >= totalSeconds) ended = true;
    }

    if (ended) {
      matchEnded = true;
      clearInterval(iv);

      const finalHome = game.getHomeScore();
      const finalAway = game.getAwayScore();
      const elapsed   = Math.round((Date.now() - startMs) / 1000);
      const winner: 'home' | 'away' | 'draw' =
        finalHome > finalAway ? 'home' :
        finalAway > finalHome ? 'away' : 'draw';

      callbacks.onMatchEnd?.({
        winner,
        score:           { home: finalHome, away: finalAway },
        durationSeconds: elapsed,
      });
    }
  }, 150); // poll every 150ms — light enough, fast enough

  return { destroy: () => clearInterval(iv) };
}