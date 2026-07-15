# Node Editor Toggle Animation Lab

## Goal

Create a standalone HTML prototype for evaluating a boolean toggle that fits the content node editor. The control should feel precise and restrained while giving its state change a noticeable spring-glide motion.

## Visual Direction

The prototype mirrors the existing editor's compact, light form controls: dark slate labels, muted helper text, a neutral slate track, a white thumb, and the editor's blue active and focus colors. The primary preview uses a label and helper-text row with the toggle aligned on the right, based on the supplied two-factor-auth reference.

The motion remains functional rather than decorative. Pressing the toggle slightly compresses the thumb; the thumb then glides, overshoots, and settles. The track color changes independently so its timing can be evaluated. No particles, glow effects, or ornamental animation are included.

## Prototype Structure

The single HTML file contains:

1. A primary form-row preview with editable checked and unchecked states.
2. Presets for Spring glide, Soft settle, and Crisp snap.
3. A tuning panel with range controls and visible numeric values.
4. Replay, reset, and copy-parameters actions.
5. A live output area showing the exact copied configuration.

The file has no build step or external runtime dependencies and can be opened directly in a browser.

## Tunable Parameters

- Animation duration in milliseconds.
- Thumb overshoot in pixels.
- Press squash as a scale value.
- Track width and height.
- Thumb size.
- Resting and active shadow strength.
- Track color-transition duration.
- Motion easing, selected from a focused set of editor-appropriate curves.

Changing a parameter updates the preview immediately. Preset selection applies a coherent parameter group, after which every value remains independently adjustable.

## Interaction and State

The visible control is backed by a native checkbox. Pointer click, Space, and keyboard focus retain native behavior. State changes trigger the current animation. Replay runs the same motion without changing the final state. Reset restores the recommended Spring glide values.

The preview supports both directions because unchecked-to-checked and checked-to-unchecked motion can feel different. The state label and copied output always reflect the current configuration.

## Export Format

The copy action writes a compact JSON object to the clipboard with stable property names and units documented in the object. It includes the selected preset name, dimensions, timing, overshoot, squash, shadow, and easing. A generated CSS custom-property block is included alongside the JSON in the visible output so the values can be transferred into the eventual Vue component.

Copy success is confirmed in the button label and a polite live region. If the Clipboard API is unavailable, the output is selected for manual copying.

## Accessibility

- Native checkbox semantics and an explicit label.
- Strong visible focus treatment matching the editor blue.
- Minimum 44-pixel interactive target around the compact visual control.
- Live state and copy feedback without disruptive alerts.
- `prefers-reduced-motion` disables overshoot and squash and shortens transitions.
- Controls have associated labels and keyboard-operable inputs.

## Responsive Behavior

The preview and controls form a two-column workbench on wide screens. They stack on smaller screens without horizontal overflow. The form-row preview preserves the right-aligned toggle until narrow mobile widths, where it remains legible and touch-friendly.

## Validation

Open the HTML file in a real browser and verify:

- All presets produce distinct but restrained motion.
- Every range and easing control updates the preview and output.
- Toggle, replay, reset, and copy work with pointer and keyboard input.
- Checked and unchecked animations settle at exact endpoints.
- Reduced-motion behavior removes nonessential movement.
- The page remains usable at desktop and mobile viewport widths.

