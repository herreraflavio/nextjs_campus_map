# Static MapLibre Calibration

This directory serves the standalone MapLibre map at:

- `/maplibre?id=<map-id>`
- `/maplibre/<map-id>`

The selected outlines are calibrated in `index.html` near the top of the file in the `<style>` block.

## Animated graphic outline

Animated line graphics use a generated outline image behind the current sprite frame.

Current selector:

```css
.map-sprite-outline {
  transform: translateY(5px) scale(1.07);
}
```

Calibration:

- Increase `translateY(...)` to push the outline farther down.
- Decrease `translateY(...)` to raise the outline.
- Increase `scale(...)` to make the outline extend farther beyond the graphic.
- Decrease `scale(...)` to tighten the outline around the graphic.

Small changes are best. Try `1px` steps for `translateY` and `0.02` steps for `scale`.

## Selected event-pin outline

Event pins use the static outline asset at `/icons/event-pin-selected-outline.png` behind `/icons/event-pin.png`.

Current selector:

```css
.selected-event-marker-outline {
  bottom: -5px;
  width: 28.25px;
}
```

Calibration:

- Make `bottom` more negative to push the outline farther down.
- Make `bottom` less negative to raise the outline.
- Increase `width` to make the outline larger.
- Decrease `width` to make the outline smaller.

The event pin itself is currently `28px` wide. Keep the outline slightly larger than the pin if it should remain visible around the edge.

## Related outline generation

Generated animated graphic outlines are controlled by these constants in `index.html`:

```js
const SPRITE_OUTLINE_COLOR = "#00d9ff";
const SPRITE_OUTLINE_RADIUS_PX = 8;
```

Change those only when the outline color or generated halo thickness should change. Use the CSS `transform` first for normal position and scale calibration.
