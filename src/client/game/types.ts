// Core engine-domain types shared across the simulation and renderer.
// (Team data types — TeamData, Kit — live in ./teams/types.)

import type { Ratings } from './teams/types';

export type Vec = { x: number; y: number };
export type Team = 'home' | 'away';
export type Role = 'GK' | 'DF' | 'MF' | 'ST';

export interface TeamHudStats {
  possessionPct: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tacklesWon: number;
  saves: number;
  corners: number;
  offsides: number;
}

export interface PlayerEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  team: Team;
  /** Formation anchor in field coordinates. */
  anchor: Vec;
  facing: Vec;
  /** Run-cycle phase, advanced by distance travelled. */
  animPhase: number;
  /** > 0 while playing the kick pose. */
  kickTimer: number;
  hair: string;
  skin: string;
  isGK: boolean;
  role: Role;
  /** Shirt number, shown on the back of the jersey. */
  num: number;
  /** Surname, shown in the FIFA-style selected-player indicator. */
  name: string;
  /** FIFA-style attribute card driving this player's in-game ability. */
  ratings: Ratings;
  /** > 0 while playing the goal-celebration pose (arms raised). */
  celebrating?: boolean;
  /** > 0 while a keeper is playing the dive/save pose (full-body lay-out). */
  diveTimer?: number;
  /** Direction of the current dive along the goal mouth (world-y sign). */
  diveDir?: number;
  /** Lockout so a keeper doesn't re-trigger a dive every frame. */
  diveCooldown?: number;
  /** > 0 while playing the grounded sliding-tackle pose (full-body lay-out). */
  slideTimer?: number;
  /** Direction the slide is committed along, in field coordinates. */
  slideDir?: Vec;
  /** True while this player is holding the ball overhead for a throw-in. */
  throwing?: boolean;

  /** Stats for the player. */
  stats: {
    minutes: number;

    goals: number;
    assists: number;
    
    shots: number;
    shotsOnTarget: number;
    
    passes: number;
    passesCompleted: number;
    
    tackles: number;
    tacklesWon: number;
    
    saves: number;
    corners: number;
    offsides: number;
  };
}

export interface HudState {
  homeScore: number;
  awayScore: number;
  /** In-game match seconds elapsed (counts UP, 0 -> 5400 = 90:00). */
  clock: number;
  message: string;
  possession: Team | 'none';
  /** Active player per side, for the bottom-corner broadcast lower-thirds. */
  homePlayer: { num: number; name: string } | null;
  awayPlayer: { num: number; name: string } | null;
  /** 0..1 charge of the in-progress home kick, or null when not charging. */
  charge: number | null;
  stats: {
    home: TeamHudStats;
    away: TeamHudStats;
  };
}

export type StateListener = (s: HudState) => void;
