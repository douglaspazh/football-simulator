import { useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  Settings,
  X,
} from 'lucide-react';
import {
  PitchKickGame,
  CANVAS_W,
  CANVAS_H,
  type HudState,
} from '@/client/game/engine';
import { TEAMS, type TeamData } from '@/client/game/teams';
import { findCurrentOrNextMatch, type Match } from '@/client/game/teams/schedule';
import {
  loadBindings,
  saveBindings,
  assignKey,
  codeLabel,
  controlsLegend,
  BINDING_GROUPS,
  DEFAULT_BINDINGS,
  type KeyBindings,
  type GameAction,
} from '@/client/game/keybindings';

type Phase = 'intro' | 'select' | 'playing';
type Mode = 'match' | 'cpu-vs-cpu' | 'practice';

const EMPTY_TEAM_STATS = {
  possessionPct: 50,
  shots: 0,
  shotsOnTarget: 0,
  passes: 0,
  passesCompleted: 0,
  tacklesWon: 0,
  saves: 0,
  corners: 0,
  offsides: 0,
};

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function wrap(i: number, n: number) {
  return ((i % n) + n) % n;
}

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PitchKickGame | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('match');
  const [introIdx, setIntroIdx] = useState(0); // 0 = Play Match, 1 = CPU vs CPU
  const [gameKey, setGameKey] = useState(0);
  const [bindings, setBindings] = useState<KeyBindings>(() => loadBindings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Default the team picker to the next/live World Cup 2026 fixture so the
  // matchup feels topical the moment you open the game.
  const initialMatch = useRef<Match | null>(findCurrentOrNextMatch()).current;
  const initialHomeIdx =
    initialMatch ? Math.max(0, TEAMS.indexOf(initialMatch.home)) : 0;
  const initialAwayIdx =
    initialMatch && TEAMS.indexOf(initialMatch.away) !== initialHomeIdx
      ? TEAMS.indexOf(initialMatch.away)
      : initialHomeIdx === 1 ? 0 : 1;

  // Team selection (indices into TEAMS). Left = you (home), right = CPU (away).
  const [homeIdx, setHomeIdx] = useState(initialHomeIdx);
  const [awayIdx, setAwayIdx] = useState(initialAwayIdx);
  const [activeSide, setActiveSide] = useState<'home' | 'away'>('home');

  const home: TeamData = TEAMS[homeIdx];
  const away: TeamData = TEAMS[awayIdx];

  const [hud, setHud] = useState<HudState>({
    homeScore: 0,
    awayScore: 0,
    clock: 0,
    message: '',
    possession: 'none',
    homePlayer: null,
    awayPlayer: null,
    charge: null,
    stats: {
      home: { ...EMPTY_TEAM_STATS },
      away: { ...EMPTY_TEAM_STATS },
    },
  });

  // Boot the canvas game once the match phase begins.
  useEffect(() => {
    if (phase !== 'playing' || !canvasRef.current) return;
    let game: PitchKickGame;
    if (mode === 'practice') {
      // Free-form practice: a handful of home players + a lone away keeper.
      const pHome: TeamData = {
        ...home,
        players: home.players.slice(0, 5),
        kickoffFwd: 4,
      };
      const pAway: TeamData = {
        ...away,
        players: away.players.slice(0, 1),
        kickoffFwd: 0,
      };
      game = new PitchKickGame(canvasRef.current, setHud, pHome, pAway, {
        practice: true,
        bindings,
      });
    } else if (mode === 'cpu-vs-cpu') {
      game = new PitchKickGame(canvasRef.current, setHud, home, away, {
        cpuVsCpu: true,
        bindings,
      });
    } else {
      game = new PitchKickGame(canvasRef.current, setHud, home, away, {
        bindings,
      });
    }
    gameRef.current = game;
    game.start();
    return () => {
      game.stop();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gameKey]);

  // FIFA-style keyboard navigation on the team-select screen.
  useEffect(() => {
    if (phase !== 'select' || settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.code;
      if (
        k === 'ArrowLeft' ||
        k === 'ArrowRight' ||
        k === 'Enter' ||
        k === 'KeyS' ||
        k === 'KeyD'
      ) {
        e.preventDefault();
      }
      const setActive = activeSide === 'home' ? setHomeIdx : setAwayIdx;
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        const dir = k === 'ArrowLeft' ? -1 : 1;
        setActive((cur) => {
          let n = wrap(cur + dir, TEAMS.length);
          // The CPU can't pick the team you already locked in.
          if (activeSide === 'away' && n === homeIdx)
            n = wrap(n + dir, TEAMS.length);
          return n;
        });
      } else if (k === 'Enter' || k === 'KeyS' || k === 'KeyD') {
        if (activeSide === 'home') {
          // Guarantee the CPU side differs from the just-picked home team.
          setAwayIdx((a) => (a === homeIdx ? wrap(homeIdx + 1, TEAMS.length) : a));
          setActiveSide('away');
        } else {
          setPhase('playing');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, activeSide, homeIdx, settingsOpen]);

  // Intro menu keyboard navigation (← → to choose, Enter to confirm).
  useEffect(() => {
    if (phase !== 'intro' || settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.code;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Enter')
        e.preventDefault();
      if (k === 'ArrowLeft') setIntroIdx(0);
      else if (k === 'ArrowRight') setIntroIdx(1);
      else if (k === 'Enter') startMode(introIdx === 0 ? 'match' : 'cpu-vs-cpu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, introIdx, settingsOpen]);

  const startMode = (m: Mode) => {
    setMode(m);
    if (m === 'match') {
      setPhase('select');
      setActiveSide('home');
    } else if (m === 'cpu-vs-cpu') {
      // CPU vs CPU mode: random teams selection.
      const homeIdx = Math.floor(Math.random() * TEAMS.length);
      let awayIdx = Math.floor(Math.random() * (TEAMS.length - 1));
      if (awayIdx >= homeIdx) awayIdx += 1;
      setHomeIdx(homeIdx);
      setAwayIdx(awayIdx);
      setPhase('playing');
    } else {
      // Practice mode doesn't need a team-select screen, just boot the game.
      setPhase('playing');
    }
  };

  const handleRestart = () => {
    setPhase('intro');
    setActiveSide('home');
  };
  const handleRematch = () => {
    // Re-mount the canvas game (the boot effect keys off gameKey) for a fresh
    // kickoff with the same teams.
    setGameKey((k) => k + 1);
  };

  const openSettings = () => {
    gameRef.current?.setPaused(true);
    setSettingsOpen(true);
  };
  const closeSettings = () => {
    setSettingsOpen(false);
    gameRef.current?.setPaused(false);
  };
  // Persist + push every binding change to the live engine immediately.
  const applyBindings = (next: KeyBindings) => {
    setBindings(next);
    saveBindings(next);
    gameRef.current?.setBindings(next);
  };

  return (
    <div className="min-h-full flex flex-col bg-night-950">
      {/* Brand bar — slim so the pitch gets the screen */}
      <header className="w-full flex items-center justify-between px-4 py-2 animate-fade-in">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl sm:text-3xl leading-none tracking-wide text-volt-500">
            Football Simulator <span className="text-white">2026</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {phase === 'playing' && (
            <>
              <button
                onClick={handleRematch}
                className="flex items-center gap-2 font-heading uppercase text-xs tracking-wider text-night-300 hover:text-volt-400 transition-colors"
              >
                <RotateCcw size={15} />
                Reiniciar
              </button>
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 font-heading uppercase text-xs tracking-wider text-night-300 hover:text-volt-400 transition-colors"
              >
                Menu
              </button>
            </>
          )}
          <button hidden
            onClick={openSettings}
            aria-label="Settings"
            className="flex items-center gap-2 font-heading uppercase text-xs tracking-wider text-night-300 hover:text-volt-400 transition-colors"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Pitch — full-bleed width, height-capped so it stays on one screen */}
      <div className="relative mx-auto w-fit max-w-full overflow-hidden border-y border-night-800 shadow-2xl animate-slide-up">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block w-auto h-auto max-w-full"
          style={{
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            maxHeight: 'calc(100vh - 168px)',
          }}
        />

        {/* Practice badge replaces the scoreboard — no score/team display. */}
        {phase === 'playing' && mode === 'practice' && (
          <div className="absolute top-3 left-3 flex items-center h-9 px-3 rounded-md bg-volt-500 text-night-950 font-heading uppercase text-xs font-bold tracking-[0.25em] shadow-lg shadow-black/40 select-none animate-fade-in">
            Practice
          </div>
        )}

        {/* FIFA-style broadcast scoreboard. */}
        {phase === 'playing' && mode !== 'practice' && (
          <div className="absolute top-3 left-3 flex items-stretch h-9 rounded-md overflow-hidden shadow-lg shadow-black/40 font-heading select-none animate-fade-in text-sm">
            <span
              className="w-1.5 self-stretch"
              style={{ backgroundColor: home.color }}
            />
            <span className="flex items-center pl-2 pr-1.5 bg-night-950/95 text-white uppercase tracking-wider text-xs font-bold">
              {home.abbr}
            </span>
            <span className="flex items-center px-2.5 bg-night-950/95 text-white text-base tabular-nums font-display">
              {hud.homeScore}
            </span>
            <span className="flex items-center bg-night-950/95 text-night-300 text-xs">
              –
            </span>
            <span className="flex items-center px-2.5 bg-night-950/95 text-white text-base tabular-nums font-display">
              {hud.awayScore}
            </span>
            <span className="flex items-center pl-1.5 pr-2 bg-night-950/95 text-white uppercase tracking-wider text-xs font-bold">
              {away.abbr}
            </span>
            <span
              className="w-1.5 self-stretch"
              style={{ backgroundColor: away.color }}
            />
            <span className="flex items-center px-2.5 bg-volt-500 text-night-950 text-sm tabular-nums font-bold tracking-tight">
              {fmtTime(hud.clock)}
            </span>
          </div>
        )}

        {/* Broadcast lower-thirds. */}
        {phase === 'playing' && hud.homePlayer && (
          <PlayerNameTag
            side="left"
            color={home.color}
            textColor={home.textColor}
            num={hud.homePlayer.num}
            name={hud.homePlayer.name}
            charge={hud.charge}
          />
        )}
        {phase === 'playing' && hud.awayPlayer && (
          <PlayerNameTag
            side="right"
            color={away.color}
            textColor={away.textColor}
            num={hud.awayPlayer.num}
            name={hud.awayPlayer.name}
          />
        )}

        {/* Centre message (GOAL etc.) */}
        {phase === 'playing' && hud.message && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              key={hud.message + hud.homeScore + hud.awayScore}
              className="font-display text-7xl sm:text-8xl text-volt-500 drop-shadow-[0_4px_0_rgba(0,0,0,0.6)] animate-pop tracking-wider text-center px-6"
            >
              {hud.message}
            </span>
          </div>
        )}

        {/* Intro / mode-select overlay */}
        {phase === 'intro' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-night-950/92 backdrop-blur-sm animate-fade-in px-4">
            <h2 className="font-display text-5xl sm:text-7xl text-white tracking-wide mb-2 text-center">
              FootballSimulator <span className="text-volt-500">2026</span>
            </h2>
            <br></br>
            <div className="flex flex-col sm:flex-row items-stretch gap-5 sm:gap-8">
              <ModeCard
                title="JUGAR PARTIDO"
                blurb="Escoge tus equipos y juega un partido completo de 90 minutos. ¡Compite por la victoria!"
                active={introIdx === 0}
                onHover={() => setIntroIdx(0)}
                onClick={() => startMode('match')}
              />
              <ModeCard
                title="CPU vs CPU"
                blurb="Observa cómo dos equipos controlados por la IA se enfrentan en un emocionante partido. ¡Disfruta del espectáculo!"
                active={introIdx ===1}
                onHover={() => setIntroIdx(1)}
                onClick={() => startMode('cpu-vs-cpu')}
              />
            </div>
          </div>
        )}

        {/* Team-select overlay */}
        {phase === 'select' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-night-950/92 backdrop-blur-sm animate-fade-in px-4">
            <h2 className="font-display text-5xl sm:text-6xl text-white tracking-wide mb-2">
              Selecciona los <span className="text-volt-500">EQUIPOS</span>
            </h2>
            <p className="font-body text-night-300 text-base sm:text-lg mb-6 text-center">
              <span className="text-volt-400 font-semibold">← →</span> para cambiar equipo.
              ·{' '}
              <span className="text-volt-400 font-semibold">Presiona / S / D</span>{' '}
              para confirmar.
            </p>
            {initialMatch && <FixtureBanner match={initialMatch} />}
            <div className="flex items-stretch gap-6 sm:gap-12">
              <TeamCrest
                team={home}
                tag="Tú"
                active={activeSide === 'home'}
                locked={activeSide === 'away'}
              />
              <div className="flex items-center font-display text-4xl sm:text-5xl text-night-500">
                VS
              </div>
              <TeamCrest
                team={away}
                tag="CPU"
                active={activeSide === 'away'}
                locked={false}
                useAwayKit
              />
            </div>
          </div>
        )}
      </div>

      {phase === 'playing' && mode === 'cpu-vs-cpu' && (
        <CpuVsCpuStatsPanel
          home={home}
          away={away}
          homeStats={hud.stats.home}
          awayStats={hud.stats.away}
        />
      )}

      {mode !== 'cpu-vs-cpu' && (
        <>
          {/* Controls legend */}
          <div className="w-full px-4 mt-2 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 animate-fade-in">
            {controlsLegend(bindings).map((c) => (
              <div
                key={c.label}
                className="flex flex-col items-center gap-0.5 bg-night-900 border border-night-800 rounded-lg py-1.5 px-2"
              >
                <kbd className="font-heading text-volt-400 text-sm tracking-wider">
                  {c.keys}
                </kbd>
                <span className="font-body text-[10px] text-night-300 uppercase tracking-wide">
                  {c.label}
                </span>
              </div>
            ))}
          </div>  
        </>
      )}

      {settingsOpen && (
        <SettingsModal
          bindings={bindings}
          onChange={applyBindings}
          onReset={() => applyBindings({ ...DEFAULT_BINDINGS })}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}

function CpuVsCpuStatsPanel({
  home,
  away,
  homeStats,
  awayStats,
}: {
  home: TeamData;
  away: TeamData;
  homeStats: HudState['stats']['home'];
  awayStats: HudState['stats']['away'];
}) {
  const passAcc = (ok: number, total: number) =>
    total > 0 ? `${Math.round((ok * 100) / total)}%` : '0%';

  const rows = [
    {
      label: 'Posesión',
      homeValue: `${homeStats.possessionPct}%`,
      awayValue: `${awayStats.possessionPct}%`,
      homeRaw: homeStats.possessionPct,
      awayRaw: awayStats.possessionPct,
    },
    {
      label: 'Tiros',
      homeValue: `${homeStats.shots}`,
      awayValue: `${awayStats.shots}`,
      homeRaw: homeStats.shots,
      awayRaw: awayStats.shots,
    },
    {
      label: 'Tiros a puerta',
      homeValue: `${homeStats.shotsOnTarget}`,
      awayValue: `${awayStats.shotsOnTarget}`,
      homeRaw: homeStats.shotsOnTarget,
      awayRaw: awayStats.shotsOnTarget,
    },
    {
      label: 'Pases',
      homeValue: `${homeStats.passes}`,
      awayValue: `${awayStats.passes}`,
      homeRaw: homeStats.passes,
      awayRaw: awayStats.passes,
    },
    {
      label: 'Precision de pase',
      homeValue: passAcc(homeStats.passesCompleted, homeStats.passes),
      awayValue: passAcc(awayStats.passesCompleted, awayStats.passes),
      homeRaw:
        homeStats.passes > 0
          ? (homeStats.passesCompleted * 100) / homeStats.passes
          : 0,
      awayRaw:
        awayStats.passes > 0
          ? (awayStats.passesCompleted * 100) / awayStats.passes
          : 0,
    },
    {
      label: 'Entradas ganadas',
      homeValue: `${homeStats.tacklesWon}`,
      awayValue: `${awayStats.tacklesWon}`,
      homeRaw: homeStats.tacklesWon,
      awayRaw: awayStats.tacklesWon,
    },
    {
      label: 'Atajadas',
      homeValue: `${homeStats.saves}`,
      awayValue: `${awayStats.saves}`,
      homeRaw: homeStats.saves,
      awayRaw: awayStats.saves,
    },
    {
      label: 'Tiros de esquina',
      homeValue: `${homeStats.corners}`,
      awayValue: `${awayStats.corners}`,
      homeRaw: homeStats.corners,
      awayRaw: awayStats.corners,
    },
    {
      label: 'Fuera de juego',
      homeValue: `${homeStats.offsides}`,
      awayValue: `${awayStats.offsides}`,
      homeRaw: homeStats.offsides,
      awayRaw: awayStats.offsides,
    },
  ];

  return (
    <section className="w-full px-4 mt-3 mb-2 animate-fade-in">
      <div className="mx-auto max-w-5xl rounded-2xl border border-night-800 bg-night-900/85 shadow-xl shadow-black/30 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 border-b border-night-800">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block w-2 h-5 rounded-sm"
              style={{ backgroundColor: home.color }}
            />
            <span className="font-heading text-sm sm:text-base uppercase tracking-wider text-white truncate">
              {home.name}
            </span>
          </div>
          <span className="font-heading text-[11px] sm:text-xs uppercase tracking-[0.25em] text-night-300">
            Estadisticas
          </span>
          <div className="flex items-center justify-end gap-2 min-w-0">
            <span className="font-heading text-sm sm:text-base uppercase tracking-wider text-white truncate text-right">
              {away.name}
            </span>
            <span
              className="inline-block w-2 h-5 rounded-sm"
              style={{ backgroundColor: away.color }}
            />
          </div>
        </div>

        <div className="px-4 py-3 grid grid-cols-1 gap-2">
          {rows.map((r) => {
            const total = Math.max(1, r.homeRaw + r.awayRaw);
            const homeBar = (r.homeRaw / total) * 100;
            const awayBar = (r.awayRaw / total) * 100;
            return (
              <div key={r.label} className="rounded-lg bg-night-950/70 border border-night-800 px-3 py-2">
                <div className="grid grid-cols-[56px_1fr_56px] items-center gap-3">
                  <span className="font-display text-base tabular-nums text-white text-left">
                    {r.homeValue}
                  </span>
                  <span className="font-body text-xs sm:text-sm uppercase tracking-wider text-night-300 text-center">
                    {r.label}
                  </span>
                  <span className="font-display text-base tabular-nums text-white text-right">
                    {r.awayValue}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="h-1.5 rounded-full bg-night-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${homeBar}%`, backgroundColor: home.color }}
                    />
                  </div>
                  <div className="h-1.5 rounded-full bg-night-800 overflow-hidden">
                    <div
                      className="h-full rounded-full ml-auto"
                      style={{ width: `${awayBar}%`, backgroundColor: away.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SettingsModal({
  bindings,
  onChange,
  onReset,
  onClose,
}: {
  bindings: KeyBindings;
  onChange: (next: KeyBindings) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  // The action currently waiting to capture its next keypress (null = idle).
  const [capturing, setCapturing] = useState<GameAction | null>(null);

  // While capturing, the next keydown anywhere becomes the new binding.
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturing(null);
        return;
      }
      onChange(assignKey(bindings, capturing, e.code));
      setCapturing(null);
    };
    // Capture phase so we intercept before the game's own listeners.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, bindings, onChange]);

  const isDefault = (Object.keys(DEFAULT_BINDINGS) as GameAction[]).every(
    (a) => bindings[a] === DEFAULT_BINDINGS[a],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl bg-night-900 ring-1 ring-night-700 shadow-2xl shadow-black/60 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-night-900 border-b border-night-800">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-volt-400" />
            <h3 className="font-display text-2xl text-white tracking-wide">
              SETTINGS
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-night-300 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="font-body text-sm text-night-300 mb-4">
            Click a key to rebind it, then press any key. Press{' '}
            <span className="text-volt-400">Esc</span> to cancel. Changes save
            automatically and the game stays paused while this is open.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 items-start">
            {BINDING_GROUPS.map((group) => (
            <div key={group.title} className="mb-5">
              <h4 className="font-heading uppercase text-[11px] tracking-[0.25em] text-night-500 mb-2">
                {group.title}
              </h4>
              <div className="flex flex-col gap-1.5">
                {group.actions.map(({ action, label }) => (
                  <div
                    key={action}
                    className="flex items-center justify-between gap-3 rounded-lg bg-night-950/60 px-3 py-2"
                  >
                    <span className="font-body text-sm text-white">
                      {label}
                    </span>
                    <button
                      onClick={() =>
                        setCapturing((c) => (c === action ? null : action))
                      }
                      className={`min-w-[5rem] rounded-md px-3 py-1.5 font-heading text-sm tracking-wider transition-colors ${
                        capturing === action
                          ? 'bg-volt-500 text-night-950 animate-pulse'
                          : 'bg-night-800 text-volt-400 hover:bg-night-700'
                      }`}
                    >
                      {capturing === action
                        ? 'Press…'
                        : codeLabel(bindings[action])}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 bg-night-900 border-t border-night-800">
          <button
            onClick={onReset}
            disabled={isDefault}
            className="flex items-center gap-2 font-heading uppercase text-xs tracking-wider text-night-300 hover:text-volt-400 transition-colors disabled:opacity-40 disabled:hover:text-night-300"
          >
            <RotateCcw size={14} />
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-volt-500 px-5 py-2 font-heading uppercase text-xs tracking-wider text-night-950 hover:bg-volt-400 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  blurb,
  active,
  onHover,
  onClick,
}: {
  title: string;
  blurb: string;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onClick}
      className={`group flex flex-col text-left w-72 sm:w-80 rounded-2xl p-6 transition-all duration-200 ${
        active
          ? 'ring-4 ring-volt-500 scale-105 shadow-xl shadow-black/40 bg-night-900'
          : 'ring-1 ring-night-700 opacity-80 hover:opacity-100 bg-night-900/70'
      }`}
    >
      <span
        className={`font-display text-3xl sm:text-4xl tracking-wide mb-3 ${
          active ? 'text-volt-500' : 'text-white'
        }`}
      >
        {title}
      </span>
      <span className="font-body text-sm text-night-300 leading-relaxed">
        {blurb}
      </span>
      <span
        className={`mt-5 font-heading uppercase text-xs tracking-[0.25em] transition-colors ${
          active ? 'text-volt-400' : 'text-night-500'
        }`}
      >
        {active ? '▶ Iniciar' : 'Seleccionar'}
      </span>
    </button>
  );
}

function FixtureBanner({ match }: { match: Match }) {
  const now = Date.now();
  const t = match.kickoffUTC.getTime();
  const live = now >= t && now < t + 110 * 60 * 1000;
  const time = match.kickoffUTC.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <div className="mb-6 flex items-center gap-4 px-5 py-3 rounded-xl bg-night-900/80 border border-night-800 animate-fade-in">
      <span
        className={`font-heading text-xs uppercase tracking-[0.25em] px-2.5 py-1 rounded ${
          live
            ? 'bg-rose-500/90 text-white animate-pulse'
            : 'bg-volt-500 text-night-950'
        }`}
      >
        {live ? 'Live now' : 'Next up'}
      </span>
      <span className="font-heading uppercase tracking-wider text-sm text-night-300">
        WC&nbsp;2026 · Group&nbsp;{match.group}
      </span>
      <span className="font-body text-sm text-night-300">·</span>
      <span className="font-body text-sm text-white tabular-nums">{time}</span>
    </div>
  );
}

function TeamCrest({
  team,
  tag,
  active,
  locked,
  useAwayKit = false,
}: {
  team: TeamData;
  tag: string;
  active: boolean;
  locked: boolean;
  useAwayKit?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 w-56 sm:w-64">
      <span
        className={`font-heading uppercase tracking-[0.3em] text-sm ${
          active ? 'text-volt-400' : 'text-night-300'
        }`}
      >
        {tag}
      </span>
      <div className="flex items-center gap-2 sm:gap-3">
        <ChevronLeft
          size={36}
          className={`shrink-0 transition-opacity ${
            active ? 'text-volt-500 animate-pulse' : 'text-transparent'
          }`}
        />
        <div
          className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl w-40 h-48 sm:w-44 sm:h-52 transition-all ${
            active
              ? 'ring-4 ring-volt-500 scale-105 shadow-xl shadow-black/40'
              : locked
                ? 'ring-2 ring-volt-700/60 opacity-90'
                : 'ring-1 ring-night-700 opacity-70'
          }`}
          style={{
            backgroundImage: `radial-gradient(circle at 50% 38%, ${team.color}33, rgba(10,12,18,0.96) 72%), linear-gradient(160deg, #1b2030, #0c0f17)`,
          }}
        >
          {locked && (
            <span className="absolute top-2 right-2 bg-volt-500 text-night-950 rounded-full p-1 z-10">
              <Check size={18} strokeWidth={3} />
            </span>
          )}
          <KitJersey kit={useAwayKit ? team.awayKit : team.kit} />
        </div>
        <ChevronRight
          size={36}
          className={`shrink-0 transition-opacity ${
            active ? 'text-volt-500 animate-pulse' : 'text-transparent'
          }`}
        />
      </div>
      <span className="font-heading uppercase tracking-wider text-2xl sm:text-3xl text-white text-center leading-tight">
        {team.name}
      </span>
    </div>
  );
}

/** A football shirt illustration drawn from the team's kit colours. */
function KitJersey({
  kit,
}: {
  kit: { shirt: string; sleeve: string; outline: string; shorts?: string };
}) {
  const shorts = kit.shorts ?? kit.sleeve;
  return (
    <svg
      viewBox="0 0 200 236"
      className="w-32 h-40 sm:w-36 sm:h-44 drop-shadow-[0_5px_8px_rgba(0,0,0,0.5)]"
      aria-hidden="true"
    >
      <g stroke={kit.outline} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
        {/* shorts (drawn first so the shirt hem overlaps the waistband) */}
        <path
          d="M66 150 L134 150 L140 214 L108 214 L100 178 L92 214 L60 214 Z"
          fill={shorts}
        />
        {/* shirt body silhouette */}
        <path
          d="M84 36 L58 44 L20 62 L31 104 L66 94 L64 166 L136 166 L134 94 L169 104 L180 62 L142 44 L116 36 Q100 56 84 36 Z"
          fill={kit.shirt}
        />
        {/* left sleeve */}
        <path d="M58 44 L20 62 L31 104 L66 94 Z" fill={kit.sleeve} />
        {/* right sleeve */}
        <path d="M142 44 L180 62 L169 104 L134 94 Z" fill={kit.sleeve} />
        {/* collar */}
        <path d="M84 36 Q100 56 116 36" fill="none" strokeWidth={4} />
      </g>
    </svg>
  );
}

function PlayerNameTag({
  side,
  color,
  textColor,
  num,
  name,
  charge,
}: {
  side: 'left' | 'right';
  color: string;
  textColor: string;
  num: number;
  name: string;
  charge?: number | null;
}) {
  const showCharge = charge != null;
  return (
    <div
      className={`absolute bottom-3 ${
        side === 'left' ? 'left-3' : 'right-3'
      } rounded-md overflow-hidden shadow-lg shadow-black/40 bg-night-950/95 font-heading select-none animate-fade-in`}
    >
      <div className="flex items-stretch h-9">
        {side === 'left' && (
          <span
            className="w-1.5 self-stretch"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className="flex items-center px-2.5 text-sm tabular-nums font-display"
          style={{ backgroundColor: color, color: textColor }}
        >
          {num}
        </span>
        <span className="flex items-center px-3 text-white uppercase tracking-wider text-sm font-bold">
          {name}
        </span>
        {side === 'right' && (
          <span
            className="w-1.5 self-stretch"
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      <div className="h-1 w-full bg-night-800">
        {showCharge && (
          <div
            className="h-full transition-[width] duration-75 ease-linear"
            style={{
              width: `${Math.round((charge as number) * 100)}%`,
              background:
                'linear-gradient(90deg,#39e639 0%,#ffe23a 55%,#ff8c1a 80%,#ff2e2e 100%)',
            }}
          />
        )}
      </div>
    </div>
  );
}
