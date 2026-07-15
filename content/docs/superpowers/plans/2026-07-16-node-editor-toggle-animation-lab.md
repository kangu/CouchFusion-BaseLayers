# Node Editor Toggle Animation Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a downloadable, dependency-free HTML workbench for tuning and copying the parameters of a restrained node-editor toggle animation.

**Architecture:** A single standalone HTML document owns its preview, controls, styles, and JavaScript so it opens from disk without a build step. One normalized configuration object drives CSS custom properties, preset selection, the live export, and clipboard output.

**Tech Stack:** Semantic HTML, CSS custom properties and keyframes, vanilla ES2020 JavaScript, Clipboard API with selection fallback, Playwright browser verification.

## Global Constraints

- Store the artifact at `docs/prototypes/node-editor-toggle-animation-lab.html`.
- Use no external runtime dependencies, fonts, images, or build tools.
- Preserve native checkbox semantics and keyboard behavior.
- Use the node editor's slate, white, and blue visual language.
- Support `prefers-reduced-motion: reduce`.
- Export stable JSON parameters and a CSS custom-property block.

---

### Task 1: Standalone Preview and Tuning Surface

**Files:**
- Create: `docs/prototypes/node-editor-toggle-animation-lab.html`

**Interfaces:**
- Produces: DOM controls identified by `toggle-input`, `replay-button`, `reset-button`, `copy-button`, `preset-select`, `easing-select`, and `output`.
- Produces: range inputs with `data-param` names matching the configuration keys.

- [ ] **Step 1: Write the structural acceptance check**

Run this check before the file exists:

```bash
test -f docs/prototypes/node-editor-toggle-animation-lab.html && \
rg -q 'id="toggle-input"' docs/prototypes/node-editor-toggle-animation-lab.html && \
rg -q 'id="copy-button"' docs/prototypes/node-editor-toggle-animation-lab.html
```

Expected: FAIL because the artifact does not exist.

- [ ] **Step 2: Create the semantic document shell**

Create a complete HTML5 document containing:

```html
<main class="lab-shell">
  <section class="preview-panel" aria-labelledby="preview-title">
    <div class="form-row">
      <span class="field-copy">
        <span id="preview-title" class="field-label">Two-factor auth</span>
        <span class="field-help">Require a code at sign-in</span>
      </span>
      <label class="toggle-hitbox">
        <input id="toggle-input" type="checkbox" role="switch" aria-labelledby="preview-title">
        <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
      </label>
    </div>
  </section>
  <section class="controls-panel" aria-label="Animation controls"></section>
</main>
```

Use CSS custom properties for dimensions, timing, overshoot, squash, easing, shadows, and colors. Style a responsive two-column workbench, a compact screenshot-matched form row, accessible buttons, range controls, focus rings, and a monospace output panel.

- [ ] **Step 3: Add all tuning controls**

Add selects for preset and easing plus ranges with these exact names and limits:

```js
const ranges = {
  duration: { min: 120, max: 700, step: 10, unit: 'ms' },
  overshoot: { min: 0, max: 8, step: 0.5, unit: 'px' },
  squash: { min: 0.72, max: 1, step: 0.01, unit: '' },
  trackWidth: { min: 44, max: 80, step: 1, unit: 'px' },
  trackHeight: { min: 24, max: 42, step: 1, unit: 'px' },
  thumbSize: { min: 18, max: 36, step: 1, unit: 'px' },
  shadow: { min: 0, max: 24, step: 1, unit: 'px' },
  colorDuration: { min: 80, max: 500, step: 10, unit: 'ms' }
};
```

Include Replay, Reset, and Copy parameters buttons; checked-state text; a polite copy-status live region; and a read-only output area.

- [ ] **Step 4: Run the structural check**

Run:

```bash
test -f docs/prototypes/node-editor-toggle-animation-lab.html && \
rg -q 'id="toggle-input"' docs/prototypes/node-editor-toggle-animation-lab.html && \
rg -q 'id="copy-button"' docs/prototypes/node-editor-toggle-animation-lab.html
```

Expected: PASS.

### Task 2: Config-Driven Motion and Export

**Files:**
- Modify: `docs/prototypes/node-editor-toggle-animation-lab.html`

**Interfaces:**
- Consumes: DOM controls and `data-param` range inputs from Task 1.
- Produces: `state`, `presets`, `applyState()`, `playToggleMotion()`, `renderOutput()`, and `copyParameters()`.

- [ ] **Step 1: Define presets and normalized state**

Use these exact starting values:

```js
const presets = {
  spring: { duration: 360, overshoot: 3, squash: 0.86, trackWidth: 62, trackHeight: 34, thumbSize: 28, shadow: 10, colorDuration: 220, easing: 'spring' },
  soft: { duration: 480, overshoot: 1.5, squash: 0.92, trackWidth: 62, trackHeight: 34, thumbSize: 28, shadow: 8, colorDuration: 300, easing: 'soft' },
  crisp: { duration: 220, overshoot: 0.5, squash: 0.82, trackWidth: 62, trackHeight: 34, thumbSize: 28, shadow: 6, colorDuration: 140, easing: 'crisp' }
};
```

Map easing names to `cubic-bezier(0.34, 1.56, 0.64, 1)`, `cubic-bezier(0.22, 1, 0.36, 1)`, and `cubic-bezier(0.2, 0.8, 0.2, 1)`.

- [ ] **Step 2: Implement live configuration**

`applyState()` must clamp the thumb size so it remains inside the track, write all CSS custom properties, synchronize input values and visible readouts, update checked-state copy, and call `renderOutput()`.

Every range input updates only its corresponding numeric property. Manual changes set the preset select to `Custom`. Selecting a preset replaces the full state with a cloned preset and replays the current direction.

- [ ] **Step 3: Implement the animation**

On checkbox change, set a `data-direction` attribute and restart a `is-animating` class. Use direction-specific keyframes: press squash, glide past the endpoint by `--overshoot`, then settle exactly at the calculated endpoint. Replay toggles to the opposite state and back on the next animation frame so both the state and motion remain truthful.

In reduced-motion mode, set duration to `1ms`, overshoot to `0px`, and squash to `1` through a media query.

- [ ] **Step 4: Implement output and clipboard fallback**

Render an object with this stable shape:

```js
{
  preset: 'spring',
  durationMs: 360,
  overshootPx: 3,
  pressScale: 0.86,
  track: { widthPx: 62, heightPx: 34 },
  thumbSizePx: 28,
  shadowBlurPx: 10,
  colorDurationMs: 220,
  easing: { name: 'spring', css: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
}
```

Copy JSON followed by a CSS custom-property block. Use `navigator.clipboard.writeText()` when available; otherwise select the output and run `document.execCommand('copy')`. Announce success or manual-copy fallback in the live region.

- [ ] **Step 5: Run static behavior checks**

Run:

```bash
rg -q 'prefers-reduced-motion: reduce' docs/prototypes/node-editor-toggle-animation-lab.html && \
rg -q 'navigator.clipboard.writeText' docs/prototypes/node-editor-toggle-animation-lab.html && \
rg -q 'cubic-bezier\(0.34, 1.56, 0.64, 1\)' docs/prototypes/node-editor-toggle-animation-lab.html
```

Expected: PASS.

### Task 3: Browser Verification and Result Documentation

**Files:**
- Modify: `docs/prototypes/node-editor-toggle-animation-lab.html` only for defects found during verification.
- Create: `docs/implementation_results/2026-07-16-node-editor-toggle-animation-lab.md`

**Interfaces:**
- Consumes: completed standalone prototype.
- Produces: verified downloadable artifact and implementation record.

- [ ] **Step 1: Open the artifact in Chromium**

Use Playwright against the local `file://` URL. Verify the title, preview row, all eight range controls, both selects, three action buttons, and checked-state output are visible.

- [ ] **Step 2: Exercise the interaction**

Click the toggle and assert `checked === true`. Select Soft settle and assert duration is `480`. Change duration to `410` and assert preset reads `Custom`. Click Reset and assert Spring glide and duration `360` are restored.

- [ ] **Step 3: Verify keyboard and responsive behavior**

Focus the checkbox, press Space, and assert its state changes. Test at `1440x1000` and `390x844`; assert `document.documentElement.scrollWidth === window.innerWidth` at both widths.

- [ ] **Step 4: Verify copy output**

Grant clipboard permissions where supported, click Copy parameters, and assert the live status reports success and the visible output contains `durationMs`, `pressScale`, and `--toggle-duration`.

- [ ] **Step 5: Document the result**

Record the initial prompt, approved plan, files created, interaction coverage, browser results, and next steps in the implementation-result document.

- [ ] **Step 6: Run final validation**

Run:

```bash
git diff --check && \
rg -n "TODO|TBD|PLACEHOLDER" docs/prototypes/node-editor-toggle-animation-lab.html docs/implementation_results/2026-07-16-node-editor-toggle-animation-lab.md
```

Expected: `git diff --check` passes and `rg` returns no matches.

