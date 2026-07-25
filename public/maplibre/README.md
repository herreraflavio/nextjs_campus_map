# Static MapLibre Calibration

This directory serves the standalone MapLibre map at:

- `/maplibre?id=<map-id>`
- `/maplibre/<map-id>`

The selected outlines are calibrated in `index.html` near the top of the file in the `<style>` block.

## Esri basemaps

By default, the static MapLibre page tries to use an Esri paid basemap style through:

```text
/api/maplibre/esri-basemap
```

That endpoint creates an ArcGIS Basemap Styles session and returns a short-lived style URL for MapLibre. It reads the API key from the first available environment variable:

```text
ARCGIS_API_KEY
ESRI_API_KEY
NEXT_PUBLIC_ARCGIS_API_KEY
```

The key needs the ArcGIS basemap privilege, usually `premium:user:basemaps`.

Style selection order:

1. `?esriStyle=<style>`
2. `?basemapStyle=<style>`
3. `?basemap=<style>` when it is not `osm`, `openstreetmap`, `custom`, or `raster`
4. The saved map setting `settings.baseMap`
5. Fallback: `arcgis/navigation`

Examples:

```text
/maplibre/<id>?esriStyle=arcgis/imagery
/maplibre/<id>?basemap=arcgis/navigation
/maplibre?id=<id>&basemapStyle=arcgis/light-gray
```

To force the old OSM fallback path for performance comparison:

```text
/maplibre/<id>?basemap=osm
/maplibre/<id>?basemapMode=osm
```

The custom campus raster tile layer still gets appended above the Esri basemap. If the Esri session or style request fails, the page falls back to the OSM/custom-raster style.

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
