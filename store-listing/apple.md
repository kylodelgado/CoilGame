# App Store Listing — Coil (iOS)

Copy-paste source for App Store Connect. Character limits are noted per field;
counts for the limited fields are verified in the notes at the bottom.

---

## App name

```
Coil
```

## Subtitle (30 chars max)

```
Snake with modes & powerups
```

(27 characters)

## Promotional text (170 chars max)

```
Classic snake, then some: walls that build themselves mid-run, a world bigger than your screen, and six pickups that flip a run on its head. One more game. Always.
```

(163 characters)

## Full description (~2500 chars)

```
Coil is snake the way you remember it — and three ways you don't.

Glide across a glowing grid. Eat, grow, speed up, and outmaneuver your own tail. Every bite makes the game a touch faster, so a calm start tightens into a white-knuckle finish — and the moment you crash, you already know what you'd do differently. Easy to pick up in one game, hard to put down after ten.

THREE MODES, THREE MOODS
• Classic — one board, pure focus. Choose solid walls for the old-school dead-stop challenge, or portal walls that wrap you to the far side.
• Dynamic Walls — the board fights back. Obstacle walls appear while you play and the oldest crumble away, so no two runs ever share a shape.
• GPS — a huge world beyond the edges of your screen. The camera rides with your snake; follow the on-screen arrow to your next meal like a navigator. (It's just a name — Coil never uses your real location.)

SIX PICKUPS THAT FLIP A RUN
Grab them before they fade: a gold Bonus for a burst of points, a Magnet that pulls food to you, Slow to ease the pace when things get frantic, Shrink to trim your tail on a crowded board, 2x Score to double everything for a stretch, and the Wall Buster — smash through the walls closing in around you.

CONTROLS THAT FEEL RIGHT
Three schemes, your choice: Slide (flick anywhere to steer), a classic D-Pad, or a virtual Joystick that follows your thumb. Accidental-turn protection and input buffering mean the snake goes exactly where you meant it to.

MAKE IT YOURS
• Three board densities: Classic for big chunky cells and a mellow pace, Standard for the balanced middle, Dense for a fast, roomy grid
• Retro skins: green phosphor, amber CRT, mono LCD, and full neon
• Sound and haptics toggles — play loud or play silent
• A 3D-shaded snake that flexes and glides, not just squares on a grid

CHASE THE BOARDS
Your best score is tracked separately for every mode and wall combination, saved on your device — so Classic-with-solid-walls and GPS each have their own summit to climb. Feeling public? Create an account — or hop on anonymously — and put your name on the online leaderboard.

BUILT TO RESPECT YOU
• Plays fully offline — no account required, ever
• Auto-pauses when life interrupts; resume with a countdown
• One optional purchase, Coil Premium, removes ads for good
• No location access, no analytics trackers

One board. One snake. One more game.
```

(~2,380 characters — room to spare under the 4,000 limit; expand freely.)

## Keywords (100 chars max, comma-separated, no spaces)

```
snake,arcade,retro,classic,grid,slither,powerups,leaderboard,neon,casual,offline,maze,highscore
```

(95 characters. Do not repeat "Coil" — the app name is already indexed.)

## URLs

- Support URL: `https://REPLACE-ME.example/coil/support` <!-- OWNER TODO: real support page or a GitHub Pages/Notion page with the contact email -->
- Marketing URL (optional): `https://REPLACE-ME.example/coil` <!-- OWNER TODO: optional; can be left blank -->
- Privacy Policy URL: <!-- OWNER TODO: host the privacy policy (same text as in-app src/legal/privacyPolicy.ts) at a public URL; App Store Connect requires one -->

---

## App Privacy questionnaire — exact selections

Apple asks "What data does this app collect?" Answer per data type:

| Data type | Collected? | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|---|
| Contact Info > Email Address | Yes — ONLY if the user creates an account (anonymous and offline play collect none) | Yes (it is the account) | No | App Functionality |
| User Content > Other User-Generated Content (display name) | Yes — only with an account/anonymous leaderboard profile; shown publicly on the leaderboard | Yes | No | App Functionality |
| Identifiers > User ID (Firebase account ID) | Yes — only with an account | Yes | No | App Functionality |
| Identifiers > Device ID (advertising identifier) | Yes — ONLY in builds where AdMob is configured | No | See tracking note below | Third-Party Advertising |
| Purchases | No — payment is processed entirely by Apple; the app never sees payment details and stores only an on-device unlock flag | — | — | — |
| Location | Not collected. (The "GPS" game mode is a fictional name; the app never requests location permission.) | — | — | — |
| Diagnostics / Analytics | Not collected — no analytics SDK, no crash reporting | — | — | — |

**Tracking question ("Do you or your third-party partners use data for tracking?"):**

- If AdMob ships with **personalized ads enabled**: answer **Yes** — the advertising identifier is used by Google to serve personalized ads across apps. The App Tracking Transparency prompt must be shown, and ads fall back to non-personalized when the user denies it.
- If AdMob is **not configured**, or ships with **non-personalized ads only**: answer **No** — no data leaves the device for cross-app tracking. Also remove the Identifiers > Device ID row above in that case.

Answer the questionnaire for the build you are actually submitting.

---

## Age rating questionnaire

Answer **None / No** to all of: cartoon or fantasy violence; realistic violence; prolonged graphic violence; profanity or crude humor; mature/suggestive themes; horror/fear themes; medical/treatment information; alcohol, tobacco, or drug use; simulated gambling; sexual content or nudity; graphic sexual content.

- Unrestricted web access: **No**
- Gambling and contests: **No**
- Made for Kids: **No**

Expected result: **4+**. (If Apple's newer questionnaire asks about in-app ads or user-to-user interaction, answer: contains ads (when configured), leaderboard display names visible to others, no messaging/chat — this may land the rating at 9+ in some storefronts; either outcome is acceptable.)

---

## App Review notes (paste into "Notes" in App Store Connect)

```
No demo account is needed: every feature is reachable without signing in, and the leaderboard offers an anonymous "play as guest" path — reviewers can exercise account creation with any email if desired, and delete the account in-app from the Account screen.

Note on the leaderboard: in this build the leaderboard/account system runs against an in-app stub (no external server), pending production Firebase wiring. All flows are testable as-is.

Note on the "GPS" game mode: the name is fictional flavor for a large scrolling game world with a food-direction arrow. The app does NOT use Core Location, requests no location permission, and collects no location data.

Ads (Google AdMob) and the Coil Premium purchase only appear in builds where they are configured. The app is fully playable offline.
```

---

## Screenshot shot list (6 shots)

Portrait, capture on the largest required iPhone size and scale down. One caption line each, set in the app's neon style:

1. **Classic mode mid-run, neon skin, snake mid-turn** — "Snake, the way you remember it."
2. **Dynamic Walls with obstacles visibly mid-spawn and a Wall Buster glyph on the board** — "The board fights back."
3. **GPS mode with the camera mid-world and the food arrow pointing off-screen** — "A world bigger than your screen."
4. **A pickup moment: 2x Score banner + active-effect countdown chips visible** — "Six pickups. Zero mercy."
5. **Settings screen showing skins and the three control schemes** — "Your controls. Your look."
6. **Leaderboard screen with display names and scores** — "Put your name on the board."
