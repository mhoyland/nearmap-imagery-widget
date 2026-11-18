# Nearmap Imagery

Shows Nearmap aerial imagery on a map. The widget lists the dates Nearmap has captured imagery at the map centre, lets the user pick one, and can swipe between two dates.

Written from scratch for Experience Builder 1.21, inspired by the [BGT Devhub / Esri Australia Nearmap widget](https://github.com/bgtdevhub/nearmap-widget). It contains none of that widget's code.

This widget does not include a Nearmap API key. You need your own Nearmap subscription.

## Installation

ArcGIS Experience Builder Developer Edition 1.21.

1. Copy this folder to `client/your-extensions/widgets/nearmap-imagery`.
2. Restart the client dev server (`npm start` in `client/`).
3. Add the widget to an experience in the builder.

## Setup

1. Add a Map widget, then add Nearmap Imagery. A Widget Controller works well, since the widget is designed for a panel about 300px wide.
2. In the widget settings, select the map and paste your Nearmap API key.
3. Save and preview.

## Requirements

- A Nearmap subscription and API key with Tile API and Coverage API access.
- A 2D or 3D map in Web Mercator (WKID 3857). Nearmap tiles can't be shown on maps in other coordinate systems, such as GDA2020 MGA. Swipe compare needs a 2D map.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Map | none | Required. |
| Nearmap API key | empty | Saved in the app config and sent in every request. Anyone who can open the app can read it, so only share the app with people who should have Nearmap access. If the key leaks, regenerate it in Nearmap and paste the new one here. |
| Show imagery when the app opens | off | |
| Allow swipe compare | on | |
| Hide imagery when the widget closes | on | Applies in a Widget Controller. The layers are hidden, not removed. |
| Starting opacity | 100% | Users can change it in the widget. |

These values can only be changed in `config.json`: `tileUrl`, `coverageUrl`, `tileType` (`Vert`), `coverageZoom` (14) and `maxZoom` (24).

## Behaviour

- Capture dates come from the Coverage API for the zoom-14 tile under the map centre. A new lookup runs only when the centre moves to a different tile, 400ms after the map stops moving. Older lookups are cancelled.
- The imagery is added to the map as a layer, so it appears in the Layers widget as "Nearmap 15 Mar 2026". While comparing, the layers are named "Nearmap A · …" and "Nearmap B · …".
- Turning imagery off, or closing the widget when "Hide imagery when the widget closes" is on, only hides the layers. They stay in the layer list, where each can be ticked on by itself without the swipe. Switching the widget back on shows both and brings the swipe back.
- Each date is shown with a `WebTileLayer` and `until=<date>`, so areas the selected capture doesn't cover are filled with older imagery.
- While imagery is on, the map can zoom to `maxZoom`. The map's original zoom limits come back when imagery is turned off.
- Swipe uses the `arcgis-swipe` map component. A is the left side and B is the right.
- If the map moves somewhere a selected date wasn't captured, the widget picks the closest available date and shows a note saying which date it switched to. The note closes after 8 seconds, when the user picks a date, or when they dismiss it.
- While comparing, labels at the top of the map show which date is on each side of the swipe line, and move with it. A label is hidden when the line is within 150px of that edge of the map.
- While comparing, a line at the top of the date list names the slot the next click will fill, with a link to switch to the other slot.

## Licence

[MIT](LICENSE)
