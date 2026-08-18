# Google Play Listing — Coil (Android)

Copy-paste source for the Play Console. Character limits noted per field;
counts for the limited fields are verified in the notes.

---

## Title (30 chars max)

```
Coil — Snake with Powerups
```

(26 characters)

## Short description (80 chars max)

```
Snake, evolved: shifting walls, a huge world, six powerups. One more run.
```

(73 characters)

## Full description (4000 chars max)

```
Coil is snake the way you remember it — and three ways you don't.

Glide across a glowing grid. Eat, grow, speed up, and outmaneuver your own tail. Every bite makes the game a touch faster, so a calm start tightens into a white-knuckle finish — and the moment you crash, you already know what you'd do differently. Easy to pick up in one game, hard to put down after ten.

THREE MODES, THREE MOODS

★ Classic — one board, pure focus. Choose solid walls for the old-school dead-stop challenge, or portal walls that wrap you to the far side.

★ Dynamic Walls — the board fights back. Obstacle walls appear while you play and the oldest crumble away, so no two runs ever share a shape.

★ GPS — a huge world beyond the edges of your screen. The camera rides with your snake; follow the on-screen arrow to your next meal like a navigator. (It's just a name — Coil never uses your real location and requests no location permission.)

SIX PICKUPS THAT FLIP A RUN

Grab them before they fade: a gold Bonus for a burst of points, a Magnet that pulls food to you, Slow to ease the pace when things get frantic, Shrink to trim your tail on a crowded board, 2x Score to double everything for a stretch, and the Wall Buster — smash through the walls closing in around you.

CONTROLS THAT FEEL RIGHT

Three schemes, your choice: Slide (flick anywhere to steer), a classic D-Pad, or a virtual Joystick that follows your thumb. Accidental-turn protection and input buffering mean the snake goes exactly where you meant it to.

MAKE IT YOURS

★ Three board densities: Classic for big chunky cells and a mellow pace, Standard for the balanced middle, Dense for a fast, roomy grid
★ Retro skins: green phosphor, amber CRT, mono LCD, and full neon
★ Sound and haptics toggles — play loud or play silent
★ A 3D-shaded snake that flexes and glides, not just squares on a grid

CHASE THE BOARDS

Your best score is tracked separately for every mode and wall combination, saved on your device — so Classic-with-solid-walls and GPS each have their own summit to climb. Feeling public? Create an account — or hop on anonymously — and put your name on the online leaderboard.

BUILT TO RESPECT YOU

★ Plays fully offline — no account required, ever
★ Auto-pauses when life interrupts; resume with a countdown
★ One optional purchase, Coil Premium, removes ads for good
★ No location access, no analytics trackers

One board. One snake. One more game.
```

(~2,420 characters — well under the 4,000 limit.)

---

## Content rating questionnaire (IARC)

Category: **Game**. Answer **No** to all content questions:

- Violence (any form, toward any character): **No**
- Sexuality / nudity: **No**
- Language / profanity: **No**
- Controlled substances (drugs, alcohol, tobacco): **No**
- Gambling themes or simulated gambling: **No**
- Crude humor / horror themes: **No**

Interactive elements (answer honestly — these do not change the age rating but are disclosed):

- Users interact online: **Yes** — public leaderboard shows user-chosen display names and scores. No chat or messaging.
- Shares user-provided information with other users: **Yes** — display name + score, leaderboard only.
- Shares the user's location with other users: **No**
- Digital purchases: **Yes** (Coil Premium)
- Contains ads: **Yes** (when AdMob is configured in the build)

Expected result: **Everyone / PEGI 3** with "Users Interact", "In-App Purchases", and "Contains Ads" interactive-element labels.

---

## Data Safety form matrix

Mirror of the privacy policy (src/legal/privacyPolicy.ts). Answer the form for
the build being shipped: rows marked "ads builds only" apply only when AdMob is
configured; drop them otherwise.

| Data type (Play taxonomy) | Collected? | Shared? | Purpose | Optional? | Notes |
|---|---|---|---|---|---|
| Personal info > Email address | Yes | No | Account management | Yes — only if the user creates an account | Stored with Firebase Authentication (service provider, not "sharing" under Play's definition) |
| Personal info > User IDs | Yes | No | Account management, App functionality | Yes — account/anonymous leaderboard users only | Firebase account ID + user-chosen display name; display name is visible publicly on the leaderboard |
| App activity > Other user-generated content | Yes | No | App functionality | Yes | Leaderboard scores with display name, publicly visible in-app |
| Device or other IDs (advertising ID) | Yes (ads builds only) | Yes — with Google AdMob | Advertising or marketing | Yes — user can opt out of personalization; Premium removes ads | Used to serve, cap, and measure ads; personalized only with consent |
| Location (approximate or precise) | **No** | No | — | — | The "GPS" mode is a fictional name; no location permission is requested |
| Financial info (purchase history) | No | No | — | — | Payments handled entirely by Google Play; app stores only an on-device unlock flag |
| App activity > App interactions / Analytics | No | No | — | — | No analytics SDK |
| App info and performance (crash logs, diagnostics) | No | No | — | — | No crash reporting SDK |

Security-practices section:

- Data encrypted in transit: **Yes** (Firebase and AdMob use TLS)
- Users can request data deletion: **Yes** — in-app account deletion, plus email (brandonbay9703@gmail.com)
- Account deletion URL (required when the app supports account creation): point to the hosted privacy policy's deletion section <!-- OWNER TODO: hosted URL -->

---

## Target audience & content

- Target age group: **13-15, 16-17, 18+** (i.e. 13 and older). Do NOT select any under-13 group — the app is not directed at children and this avoids Play Families policy scope.
- "Appeals to children" review: answer that the app targets a general audience 13+.

## Ads declaration

- Contains ads: **Yes** (AdMob banners, interstitials, optional rewarded ads — declared even though they are inactive until configured; if shipping a build with no AdMob configuration and no ads, declare **No** for that build).

## Store settings

- App category: Games > Arcade
- Contact email: brandonbay9703@gmail.com
- Privacy policy URL: <!-- OWNER TODO: hosted privacy policy URL (required) -->

---

## Screenshot shot list (6 shots)

Portrait phone screenshots (16:9 or taller). One caption line each, set in the
app's neon style:

1. **Classic mode mid-run, neon skin, snake mid-turn** — "Snake, the way you remember it."
2. **Dynamic Walls with obstacles visibly mid-spawn and a Wall Buster glyph on the board** — "The board fights back."
3. **GPS mode with the camera mid-world and the food arrow pointing off-screen** — "A world bigger than your screen."
4. **A pickup moment: 2x Score banner + active-effect countdown chips visible** — "Six pickups. Zero mercy."
5. **Settings screen showing skins and the three control schemes** — "Your controls. Your look."
6. **Leaderboard screen with display names and scores** — "Put your name on the board."
