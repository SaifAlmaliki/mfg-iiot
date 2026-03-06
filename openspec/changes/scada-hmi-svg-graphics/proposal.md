## Why

The SCADA panel today has a basic "HMI View" tab with a hardcoded layout and fixed tag bindings. To make SCADA production-ready we need configurable, SVG-based process graphics that engineers can author (symbols, layout, tag bindings, controls), store in the database with permissions, and that operators can view with live data. This enables plant-specific HMIs without code changes and aligns with the UNS Platform IIoT readiness goal.

## What Changes

- **New DB models**: `HmiGraphic` (saved screens), graphic elements (symbol instances, positions, bindings), and symbol library (predefined + user-defined). All queryable and permission-aware.
- **Graphics editor**: SVG-based canvas where authorized users (engineers/admins) place symbols from a library, bind elements to tags, and configure interactive controls (setpoints, buttons). Support for predefined symbols (pumps, valves, tanks) and custom SVG uploads.
- **Graphics runtime**: Replace the current HMI View tab with a list of saved graphics; "View" opens the selected graphic with live tag data, alarm highlighting, and interactive setpoints/buttons. "Edit" opens the editor for that graphic (subject to permissions).
- **Permissions**: New permission (e.g. `scada.edit` or `hmi.edit`) so only certain roles (engineers, admins) can create/edit graphics; view remains permission-aware (e.g. existing `scada.view`).
- **HMI View tab behavior**: Becomes the runtime entry: list of saved graphics with Edit / View actions; selecting View renders the graphic with live data.

## Capabilities

### New Capabilities

- `hmi-graphics-models`: Database schema and APIs for HMI graphics. Models: HmiGraphic (name, description, width, height, created/updated, owner), graphic elements (graphicId, symbolId, x, y, scale, rotation, props/bindings JSON), symbol library (predefined + user-uploaded SVG, metadata). CRUD APIs with permission checks (`scada.view` for read, `scada.edit` or `hmi.edit` for create/update/delete).
- `hmi-symbol-library`: Predefined symbol set (pumps, valves, tanks, pipes, motors, etc.) as SVG assets; API and UI to list symbols and to add/manage custom symbols (upload SVG, name, category). Symbols expose bindable properties (e.g. fill for state, text for value).
- `hmi-graphics-editor`: Editor UI: canvas (SVG-based), drag-and-drop from symbol library, element selection/transform (move, resize, rotate), property panel for tag bindings and control type (display-only, setpoint, button). Save/cancel; uses hmi-graphics-models and hmi-symbol-library.
- `hmi-graphics-runtime`: Runtime viewer: load a saved graphic by id, resolve symbol SVGs and element bindings, subscribe to live tag data (existing real-time store/hooks), render values and alarm states, handle setpoint/button writes. HMI View tab: list of graphics with Edit/View; View shows runtime for selected graphic.

### Modified Capabilities

- None (no existing specs for SCADA graphics).

## Impact

- **Database**: New Prisma models (e.g. `HmiGraphic`, `HmiGraphicElement`, `HmiSymbol`), migrations. Possible role/permission seed updates for `scada.edit` or `hmi.edit`.
- **Frontend**: New routes/pages for graphics list, editor, and runtime; refactor existing HMI View tab in `scada-panel.tsx` to use runtime and list. New components for canvas, symbol palette, property panel, runtime renderer.
- **Backend**: New API routes for graphics CRUD, symbol library (list, create custom), and any server-side validation of bindings. Permission checks on all mutate operations.
- **Dependencies**: Likely SVG manipulation (e.g. react-dnd or similar for editor), no new heavy runtimes; reuse existing real-time and tag APIs.
