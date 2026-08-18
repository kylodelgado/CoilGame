import type { InfoContent } from './InfoContent';

/**
 * The in-app "How to play" guide, rendered by InfoScreen. Every mechanic
 * described here is sourced from the engine and input code (src/engine,
 * src/input, src/modes) — keep it accurate to how the game actually behaves.
 */
export const howToPlay: InfoContent = {
  title: 'How to Play',
  sections: [
    {
      heading: 'Goal',
      paragraphs: [
        'Steer your snake to the food. Every bite makes you longer, scores points, and speeds the game up a touch. Crash into a wall, an obstacle, or your own body and the run ends.',
        'Fill the entire board with snake and you win the run outright.',
      ],
    },
    {
      heading: 'Controls',
      paragraphs: [
        'Pick your control scheme in Settings. Three are available:',
        'Slide — flick anywhere on the board to steer. A quick flick in a direction turns the snake; you can chain several turns without lifting your finger. Slow, small finger movements are ignored on purpose, so resting or drifting your thumb never causes an accidental turn.',
        'D-Pad — tap the on-screen arrows. One tap, one turn. Simple and precise.',
        'Joystick — press anywhere to plant a virtual stick under your finger, then hold and drag to steer. The snake follows your thumb continuously — the lowest-latency option.',
        'Reversal protection: whatever the scheme, the game never lets you turn 180° straight back into your own body — that input is simply ignored. Quick consecutive turns are buffered (up to two), so a fast zig-zag lands exactly as you meant it.',
      ],
    },
    {
      heading: 'The three modes',
      paragraphs: [
        'Classic — the whole game on one fixed board. In Settings you choose what the edges do: Solid walls end the run on contact, Portal walls wrap you around to the opposite side.',
        'Dynamic Walls — the board starts clear, then obstacle walls appear as you play: every few seconds a new wall shape (lines, Ls, squares) lands somewhere fair — never on top of you, your food, or the cell you are about to enter. Past a limit, the oldest wall cells crumble away, so the hazard field keeps shifting.',
        'GPS — a huge world far bigger than your screen, with the camera following your snake. Obstacle walls appear here too. The food is usually somewhere off-screen: follow the arrow at the edge of the view — it always points toward the food, like a navigator. (Despite the name, this mode uses no location or GPS hardware — it is purely a game world.)',
      ],
    },
    {
      heading: 'Board presets',
      paragraphs: [
        'Presets set the grid density — how many cells fit on screen — and the pace:',
        'Classic — the fewest, biggest cells and the calmest starting speed. Standard — the balanced middle. Dense — the most cells, the most room to maneuver, and the fastest pace.',
      ],
    },
    {
      heading: 'Food, bonus pickups and powerups',
      paragraphs: [
        'Regular food is always on the board and is worth 10 points; eating it grows you by one segment and nudges the speed up.',
        'Every so often a special pickup also appears. It only stays for a limited time, so grab it before it fades. What it does depends on its shape and color:',
        'Bonus (gold circle) — instant extra points, well above a normal food, and it does not grow you. This is the most common pickup.',
        'Magnet (red horseshoe) — for a while, the food is pulled toward your head, one cell at a time. Let dinner come to you.',
        'Slow (blue triangle) — eases the game speed back a notch, permanently for the rest of the run. They stack.',
        'Shrink (green square) — trims a few segments off your tail (you never shrink below the starting length). Breathing room on a crowded board.',
        '2x Score (purple diamond) — doubles every point you earn while it lasts, including bonus pickups.',
        'Wall Buster (orange cross) — for a short time, obstacle walls near your head are smashed as you pass. It only appears in modes that have walls to smash (Dynamic Walls and GPS).',
        'Timed effects (Magnet, 2x Score, Wall Buster) show a countdown chip on screen while active; picking up the same kind again refreshes its timer.',
      ],
    },
    {
      heading: 'Scoring and best scores',
      paragraphs: [
        'Food is 10 points; bonus pickups are worth much more; 2x Score doubles everything while it runs.',
        'Your best score is tracked separately for each combination of mode and wall setting — so your Classic-with-solid-walls best lives on its own board, apart from your Portal or GPS bests. Bests are stored on your device only, and you can reset them in Settings. Sign in (or play anonymously) to post scores to the online leaderboard.',
      ],
    },
    {
      heading: 'Pausing and interruptions',
      paragraphs: [
        'Tap the pause button any time. If a call comes in or you switch apps, the game pauses itself automatically — you never lose a run to an interruption.',
        'Resuming always gives you a short 3-2-1 countdown so you are never dropped back into motion cold. On Android, the system back gesture pauses the game instead of quitting it.',
      ],
    },
  ],
};
