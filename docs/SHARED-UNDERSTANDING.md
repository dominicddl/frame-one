# FRAME ONE / Movie Map — shared understanding
**For the whole team. Product truth as of Sat Sep 26.**

---

## Why this exists

People in New York already get that feeling: “Haven’t I seen this in a movie?”  
This app helps you **know the city** by tying the place under your feet to the film scene you remember — then filling in a personal map of NYC as you explore.

Two questions we answer:
1. Help me know our city (NYC).
2. Is this a movie spot I’ve seen before?

Working names (FRAME ONE, Movie Map) don’t matter yet.

---

## The loop (what a user does)

### 1. Capture
You’re standing somewhere in NYC. You take a photo (or upload one) of what’s in front of you — street, building, landmark. That’s your “I am here” evidence.

### 2. Context
You give the app enough to aim at the right scene:
- **Where you are** (from GPS, confirm/edit if needed).
- **What you have in mind** — movie or vibe in your own words (e.g. “Spider-Man?”, “Night at the Museum”).  
**You tell it. The app does not silently guess the movie title.**

### 3. Matching screen
The app shows that your photo is being matched to a film scene — clearly **your photo** and **the scene**, side by side (or equivalent matching UI).  
This is the “we found it” proof moment.

### 4. Merge transition (this is recreate)
After the match, there is an **animation / transition**: the two images combine.  
The **film still overlays on top of your photo**, lined up with the real place (same idea as holding a print of the scene up against the real building so architecture matches).

Important:
- That overlay **is** the recreate.
- The scene is recreated **for you** when the still is placed on your photo.
- There is **no separate “now go recreate” mode**.
- **Not** cut-out characters dropped in.
- **Not** “step into the frame” with a friend/timer.

### 5. Unlock the map
After a successful match/merge:
- The spot that was a **shadowed / dark icon** becomes a **colourful stamp / sticker / icon**.
- A **small amount of fog clears** around that location.
- **Nearby unshot spots** can peek or blink so you see where else you could go.
- **Go next / trails** = suggestions of where to walk next, shown **on the map** — so discovery stays spatial (“know your city”), not a separate social feed.

### 6. Keep exploring
The more places you match, the more your NYC map lights up. That’s the long-term habit.

---

## What we always do

| Rule | Meaning |
|------|--------|
| NYC first | Curated New York spots only for now. |
| Curated catalog | Known filming places we seed — not “match any photo anywhere on earth.” |
| User supplies movie context | Keywords / title / vibe from the user. |
| Always an exact match | Every successful run ends on match → merge. |
| Side-by-side then overlay | Match screen first, then still-on-photo merge. |
| Stamp = map unlock | Shadow → colour icon; fog clears locally. |

---

## What we explicitly removed

- **Wrong spot / “you’re 180 m off — walk there”** — adds confusion; we don’t send people hunting with vague distance copy.
- **No match** — we don’t dead-end; we **guarantee a match** in the product story we’re building toward (demo can use hardcoded spots so this stays true).
- **Step-into-frame recreate**
- **Cut-out character recreate**
- Treating recreate as a second mini-app after match

---

## Nice-to-have later (do not block the core)

- **Profile page** — collected movie spots as badges/stamps (nice to have, not required for the main loop).
- **Share export** — save/share the merged overlay (Instagram etc.).
- Richer trail completion, trail badges, unlock celebration motion.
- More cities, denser catalog, clips, licensed character art.

If someone has time, they can touch these. They are **add-ons**, not the definition of done.

---

## How this feels in one sentence

Snap where you are → say what movie you’re thinking of → see your photo matched to the scene → watch the film still land on your photo → the map stamp turns colour and the neighbourhood opens a little → the map suggests where to go next.

---

## For builders (demo constraint, not product philosophy)

For a same-day demo, hardcode a small set of NYC spots (e.g. Times Square / known icons) so “always match” and the merge can be shown reliably. Rights on real stills are a later problem; placeholders are fine in the room.

---

## One-line checklist for alignment

If your work doesn’t serve **capture → context → match → merge overlay → colourful stamp + fog + go-next on the map**, it’s out of scope for the core.
