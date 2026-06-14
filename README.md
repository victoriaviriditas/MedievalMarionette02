Medieval Marionette

> *An interactive medieval puppet, controlled by your fingertips through your webcam.*

Hello from Victoria's side of GitHub! Here is a small experiment in computer vision and physics: raise your hand before your webcam, and a knight and squire will dance from invisible strings tied to your fingers. The following document is here to help you understand, edit, and try your own Medieval Marionette. 

---

## How it works

Four of your fingertips become the puppet's strings:

| Finger     | Controls                |
|------------|-------------------------|
| **Index**  | the head & helmet crown |
| **Middle** | the sword arm           |
| **Ring**   | the shield arm          |
| **Pinky**  | the spine (master string) |

The thumb stays free, as a marionettist's resting finger should. Move your hand to make the knight sway; spread your fingers to make him stand tall; close them to let him slump. The physics — verlet integration with distance constraints — does the rest.

---

## Try it on your own computer

If you have never written a line of code in your life: welcome. This guide assumes nothing. Follow the steps in order and you will have your own copy of the marionette running in about ten minutes.

### Tier 1 — Just run it (for absolute beginners)

**Step 1. Make a free GitHub account.**
GitHub is the place where programmers store their work. Go to [github.com](https://github.com) and click *Sign up*. Use any email and pick a username.

**Step 2. Fork this repository.**
A "fork" is your own personal copy of someone else's project, which you are free to change.
On this page, click the **Fork** button in the top-right corner. GitHub will create a copy under your username.

**Step 3. Download your copy to your computer.**
On your forked repository's page, click the green **Code** button, then **Download ZIP**. Unzip it anywhere — your Desktop is fine.

**Step 4. Open `index.html`.**
Double-click `index.html`. It should open in your web browser. Click *Summon the Knight*, allow camera access, and raise your hand. That is all.

> If your browser blocks the camera, try opening the file in Chrome or Firefox, and make sure you allow camera permission when prompted. Some browsers (Safari) require the file to be served from a local server — see *Tier 3* for how to do that.

---

### Tier 2 — Easy customizations (still no real coding)

Open `index.html` in a text editor. Any will do — **Notepad** on Windows, **TextEdit** on Mac (set to Plain Text mode), or download the free [Visual Studio Code](https://code.visualstudio.com/) for a friendlier experience.

Everything you might want to change is at the top of the file in a section that looks like this:

```css
:root {
  --ink: #1a1410;          /* the dark colour: outlines, armour */
  --ink-soft: #2d231c;     /* a slightly softer dark           */
  --parchment: #f4ecd8;    /* the page colour                  */
  --parchment-dark: #e8dcc0;
  --parchment-shadow: #d4c4a0;
  --crimson: #6b1e1e;      /* accent: hover effects            */
  --gilt: #8a6f2c;         /* accent: small embellishments     */
}
```

These are called **CSS variables**. Anywhere a colour is used, the file looks it up here. Change a value, save the file, refresh your browser — done.

#### Change the knight's colour

Want a knight in **midnight blue** instead of black? Replace `--ink: #1a1410;` with `--ink: #1a2a4a;`. Want him in **forest green**? Try `#1f3a26`.

The number after `#` is a hex colour code. You can pick any colour using a free tool like [coolors.co](https://coolors.co) — just paste the six characters after the `#`.

#### Change the parchment to night-sky

Replace `--parchment: #f4ecd8;` with `--parchment: #0d1117;` and `--ink: #1a1410;` with `--ink: #e8dcc0;`. Now the knight is rendered in pale ivory against a deep night.

#### Change the number of strings

Find this section in the JavaScript (search for "control strings"):

```js
points.head.controlString    = { finger: 'index',  stiffness: 0.35 };
points.handR.controlString   = { finger: 'middle', stiffness: 0.45 };
points.handL.controlString   = { finger: 'ring',   stiffness: 0.45 };
points.chest.controlString   = { finger: 'pinky',  stiffness: 0.30 };
```

Each line attaches one body part to one fingertip. To remove a string, **delete or comment out the line** by adding `//` at the start:

```js
// points.handL.controlString   = { finger: 'ring', stiffness: 0.45 };
```

To add more strings, attach more body parts. For example, to make the sword foot kick to your thumb, you would add:

```js
points.footR.controlString = { finger: 'thumb', stiffness: 0.30 };
```

…and then add `'thumb'` to the `fingerTargets` object at the top of the physics section, plus add landmark `4` (the thumb tip) to the tracking code. There is a section in the code commented `// landmark indices` that lists which finger is which number.

The **stiffness** value (between 0 and 1) controls how strongly the string pulls. Lower numbers = looser, draggier strings. Higher = tight and responsive.

#### Change his name, the title, the subtitle

Search for `The Marionette` and replace it with whatever you like. There are three places: the start screen heading, the title on stage, and the browser tab.

---

### Tier 3 — Design your own knight (some coding)

The knight is drawn entirely in **SVG** — a way of describing pictures with text, like geometry homework but pretty. Each part of the knight (head, torso, arms, sword, shield) is rendered in the `drawKnight()` function in the JavaScript.

#### The skeleton

The knight has 16 joint points defined in `buildKnight()`:

```js
points.head, points.neck, points.chest, points.hip,
points.shoulderL, points.shoulderR,
points.elbowL,    points.elbowR,
points.handL,     points.handR,
points.hipL,      points.hipR,
points.kneeL,     points.kneeR,
points.footL,     points.footR
```

These are the *bones*. You can move where they start (the initial `cx() + 40, cy() - 70` numbers) to change the knight's proportions — wider shoulders, longer legs, a bigger head, etc.

#### Drawing your own knight

Each piece of the knight is drawn inside `drawKnight()`. Look at how the helmet is drawn:

```js
helm.innerHTML = `
  <path d="M -22,-10 Q -22,-30 0,-30 Q 22,-30 22,-10 L 22,15 ..." fill="#1a1410"/>
  <rect x="-16" y="-4" width="32" height="3" fill="#f4ecd8"/>
  ...
`;
```

This is SVG. You don't have to write it by hand — use **Inkscape** (free), **Figma** (free), or **Adobe Illustrator** to draw your own helmet, then export it as SVG and paste it in. Replace the helm `innerHTML` with your own paths and the puppet will wear your design.

The same applies to the shield (look for `<path d="M -18,-5 ..."`), the sword, and the tabard cross. You can swap the knight for an **archer**, a **wizard**, a **fool**, a **dragon** — any figure with roughly the same skeleton will work.

#### Tips for making your own design feel cohesive

- Use only two colours: `var(--ink)` for dark, `var(--parchment)` for light. The fills `#1a1410` and `#f4ecd8` reference these.
- For texture, use the patterns already defined: `fill="url(#hatch)"`, `fill="url(#cross-hatch)"`, `fill="url(#dots)"`. These give you the woodcut chainmail look for free.
- Keep stroke widths between `1` and `3`. Thicker lines look heavy; thinner lines disappear.
- If your design has 100+ shapes, the physics may slow down. Aim for 30 or fewer SVG elements per body part.

---

## Sharing your version online

Once your knight looks the way you want, you can publish your fork as a website that anyone in the world can visit — for free.

1. On your forked repository, click **Settings**.
2. In the left sidebar, click **Pages**.
3. Under "Branch", choose `main` and click **Save**.
4. Wait a minute. Your version will be live at `https://YOUR_USERNAME.github.io/marionette/`.

Share that link. Their hand, your knight.

---

## Running with a local server (optional, if your browser blocks the file)

Some browsers refuse to open the camera from a `file://` URL. If yours does, you can run a tiny local server:

**If you have Python installed:**
```
cd path/to/the/folder
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**If you have Node.js installed:**
```
npx serve
```

---

## Built with

- [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) — Google's hand-tracking model, running entirely in your browser
- Verlet integration physics — written from scratch, no library
- SVG — the knight, the strings, the ornaments
- Cormorant Garamond & UnifrakturMaguntia — the fonts that make it look medieval

No data ever leaves your computer. The webcam feed is processed locally and discarded the moment you close the page.

---

## License

MIT. Take it, change it, make your own puppet show. Attribution is appreciated but not required.

---
Much medieval love from Victoria!!!!!
