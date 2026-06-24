import { tick } from '../src/engine/tick';
import {
  addOrRefresh,
  advanceEffects,
  bustWalls,
  buildPowerups,
  hasEffect,
  magnetStep,
  scoreMultiplier,
} from '../src/engine/powerups';
import { createSeededRandom } from '../src/services/RandomPort';
import type {
  ActiveEffect,
  Cell,
  GameConfig,
  GameState,
  PowerupKind,
  PowerupsConfig,
} from '../src/engine/types';

function makeGrid(columns: number, rows: number) {
  return { columns, rows, cellSize: 10, originX: 0, originY: 0 };
}

const POWERUPS: PowerupsConfig = buildPowerups({ walls: true });

function makeConfig(
  over: Partial<GameConfig> = {},
  powerups: PowerupsConfig | undefined = POWERUPS,
): GameConfig {
  return {
    grid: makeGrid(12, 12),
    wallBehavior: 'SOLID',
    baseTickMs: 200,
    minTickMs: 90,
    accelMsPerFood: 4,
    pointsPerFood: 10,
    startLength: 3,
    startDirection: 'RIGHT',
    bonus: { enabled: true, spawnEveryTicks: 60, lifetimeTicks: 25, points: 50 },
    powerups,
    ...over,
  };
}

function makeState(over: Partial<GameState> & { snake: Cell[] }): GameState {
  return {
    status: 'RUNNING',
    direction: 'RIGHT',
    inputQueue: [],
    food: { x: 11, y: 11 },
    score: 0,
    foodEaten: 0,
    tickMs: 200,
    bonusFood: null,
    bonusRemaining: 0,
    ticksUntilBonus: 60,
    obstacles: [],
    activeEffects: [],
    slowMs: 0,
    pickupBanner: null,
    ...over,
  };
}

// A pickup sitting one cell ahead of a RIGHT-moving head at (5,5).
function withPickupAhead(kind: PowerupKind, over: Partial<GameState> = {}) {
  return makeState({
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    food: { x: 0, y: 0 }, // far away so movement never eats food
    bonusFood: { x: 6, y: 5 },
    powerupKind: kind,
    bonusRemaining: 10,
    ...over,
  });
}

describe('pure effect helpers', () => {
  it('hasEffect / addOrRefresh / advanceEffects manage timers', () => {
    let fx: ActiveEffect[] = [];
    fx = addOrRefresh(fx, 'MAGNET', 5);
    expect(hasEffect(fx, 'MAGNET')).toBe(true);
    // Refresh resets to full duration rather than duplicating.
    fx = addOrRefresh(fx, 'MAGNET', 5);
    expect(fx).toHaveLength(1);
    expect(fx[0].remainingTicks).toBe(5);

    const a = advanceEffects(fx);
    expect(a.next[0].remainingTicks).toBe(4);
    expect(a.expired).toEqual([]);

    let one: ActiveEffect[] = addOrRefresh([], 'DOUBLE', 1);
    const b = advanceEffects(one);
    expect(b.next).toEqual([]);
    expect(b.expired).toEqual(['DOUBLE']);
  });

  it('magnetStep moves food one cell along the dominant axis toward the head', () => {
    // dx=3, dy=1 => step horizontally.
    expect(magnetStep({ x: 2, y: 4 }, { x: 5, y: 5 }, [], [])).toEqual({
      x: 3,
      y: 4,
    });
    // dy dominant.
    expect(magnetStep({ x: 5, y: 1 }, { x: 5, y: 5 }, [], [])).toEqual({
      x: 5,
      y: 2,
    });
  });

  it('magnetStep refuses to move onto the snake or an obstacle', () => {
    const food = { x: 2, y: 4 };
    expect(magnetStep(food, { x: 5, y: 4 }, [{ x: 3, y: 4 }], [])).toBe(food);
    expect(magnetStep(food, { x: 5, y: 4 }, [], [{ x: 3, y: 4 }])).toBe(food);
  });

  it('bustWalls removes only obstacles within the Chebyshev radius', () => {
    const head = { x: 5, y: 5 };
    const obstacles = [
      { x: 6, y: 6 }, // dist 1 -> cleared
      { x: 7, y: 5 }, // dist 2 -> cleared at radius 2
      { x: 8, y: 5 }, // dist 3 -> survives
    ];
    expect(bustWalls(obstacles, head, 2)).toEqual([{ x: 8, y: 5 }]);
  });

  it('scoreMultiplier reflects an active DOUBLE', () => {
    const cfg = makeConfig();
    expect(scoreMultiplier(makeState({ snake: [{ x: 1, y: 1 }] }), cfg)).toBe(1);
    expect(
      scoreMultiplier(
        makeState({
          snake: [{ x: 1, y: 1 }],
          activeEffects: [{ kind: 'DOUBLE', remainingTicks: 3, totalTicks: 5 }],
        }),
        cfg,
      ),
    ).toBe(POWERUPS.doubleMultiplier);
  });
});

describe('eating powerups via tick', () => {
  const rng = createSeededRandom(1);
  const config = makeConfig();

  it('POINTS awards points without growth and sets the banner', () => {
    const state = withPickupAhead('POINTS');
    const { state: next, events } = tick(state, config, rng);
    expect(next.snake).toHaveLength(3); // no growth
    expect(next.score).toBe(50);
    expect(next.bonusFood).toBeNull();
    expect(next.pickupBanner).toBe('POINTS');
    expect(events).toContain('ATE_BONUS');
  });

  it('SLOW permanently raises tickMs and accumulates slowMs', () => {
    const state = withPickupAhead('SLOW', { tickMs: 180 });
    const { state: next, events } = tick(state, config, rng);
    expect(next.slowMs).toBe(POWERUPS.slowMs);
    expect(next.tickMs).toBe(180 + POWERUPS.slowMs);
    expect(events).toContain('GOT_POWERUP');
  });

  it('SHRINK drops tail cells but never below minLength', () => {
    const long = withPickupAhead('SHRINK', {
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ],
    });
    const { state: next } = tick(long, config, rng);
    // 5 - shrinkBy(3) = 2, floored at minLength(3) after the head advances.
    expect(next.snake.length).toBeGreaterThanOrEqual(POWERUPS.minLength);
  });

  it('DOUBLE registers a timed effect that then doubles food score', () => {
    const got = withPickupAhead('DOUBLE');
    const afterPickup = tick(got, config, rng).state;
    expect(hasEffect(afterPickup.activeEffects, 'DOUBLE')).toBe(true);

    // Now eat a normal food while DOUBLE is active -> 2x points.
    const eating = makeState({
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      food: { x: 6, y: 5 },
      activeEffects: [{ kind: 'DOUBLE', remainingTicks: 10, totalTicks: 40 }],
    });
    const { state: next } = tick(eating, config, rng);
    expect(next.score).toBe(config.pointsPerFood * POWERUPS.doubleMultiplier);
  });

  it('MAGNET pulls the food toward the head each subsequent tick', () => {
    const state = makeState({
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      food: { x: 9, y: 5 },
      activeEffects: [{ kind: 'MAGNET', remainingTicks: 10, totalTicks: 40 }],
      direction: 'UP', // move away from the food so it isn't eaten
    });
    const { state: next } = tick(state, config, rng);
    // Head moved to (5,4); food drifted one cell toward it.
    expect(next.food).not.toEqual({ x: 9, y: 5 });
    const dist = Math.abs(next.food!.x - 5) + Math.abs(next.food!.y - 4);
    expect(dist).toBeLessThan(Math.abs(9 - 5) + Math.abs(5 - 4));
  });

  it('WALL_BUSTER clears obstacles around the head while active', () => {
    const state = makeState({
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      direction: 'UP',
      food: { x: 0, y: 0 },
      obstacles: [
        { x: 5, y: 3 }, // near the head's path
        { x: 11, y: 11 }, // far away -> survives
      ],
      activeEffects: [
        { kind: 'WALL_BUSTER', remainingTicks: 10, totalTicks: 30 },
      ],
    });
    const { state: next } = tick(state, config, rng);
    expect(next.obstacles).toContainEqual({ x: 11, y: 11 });
    expect(next.obstacles).not.toContainEqual({ x: 5, y: 3 });
    // The cleared cell is reported for the destruction effect.
    expect(next.bustedCells).toContainEqual({ x: 5, y: 3 });
    expect(next.bustedCells).not.toContainEqual({ x: 11, y: 11 });
  });

  it('reports no bustedCells on a tick that smashes nothing', () => {
    const state = makeState({
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      direction: 'UP',
      food: { x: 0, y: 0 },
      obstacles: [{ x: 11, y: 11 }], // far from the head
      activeEffects: [
        { kind: 'WALL_BUSTER', remainingTicks: 10, totalTicks: 30 },
      ],
    });
    const { state: next } = tick(state, config, rng);
    expect(next.bustedCells).toEqual([]);
  });
});

describe('mode gating of the pool', () => {
  it('omits WALL_BUSTER when the mode has no walls', () => {
    expect(buildPowerups({ walls: false }).pool).not.toContain('WALL_BUSTER');
    expect(buildPowerups({ walls: true }).pool).toContain('WALL_BUSTER');
  });
});

describe('classic byte-identical guarantee', () => {
  it('without config.powerups the bonus slot behaves exactly as before', () => {
    const rng = createSeededRandom(7);
    // Strip powerups entirely so the classic bonus overlay runs.
    const { powerups: _omit, ...cfg } = makeConfig();
    const state = withPickupAhead('POINTS'); // kind ignored on the classic path
    const { state: next, events } = tick(state, cfg, rng);
    expect(next.score).toBe(50);
    // The classic overlay never sets a powerup banner (left as the input null).
    expect(next.pickupBanner).toBeNull();
    expect(events).toContain('ATE_BONUS');
  });
});
