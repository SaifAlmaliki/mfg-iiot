## Context

The SCADA panel (`src/components/scada/scada-panel.tsx`) has a hardcoded "HMI View" tab: fixed layout (two reactors, pipe, motors) with direct tag bindings. Tags and real-time updates come from existing hooks (`useRealtimeStore`, `useRealtimeConnection`) and the Tag/TagValue (and real-time pipeline) data model. The platform uses Next.js, Prisma/Postgres, and role-based access via `Role.permissions` (JSON array of strings, e.g. `scada.view`, `scada.control`). The change introduces configurable SVG-based HMI graphics stored in the DB, an editor for authorized users, and a runtime that replaces the current HMI View with a list of graphics and live rendering.

## Goals / Non-Goals

**Goals:**

- Persist HMI graphics (canvas size, elements, symbol references, tag bindings, control config) in the database with permission checks.
- Provide a symbol library: predefined set (pumps, valves, tanks, etc.) plus custom SVG upload and metadata.
- Provide an editor UI (SVG canvas, drag-drop symbols, bindings, setpoints/buttons) gated by a new edit permission.
- Provide a runtime that loads a saved graphic and renders it with live tag data, alarm state, and interactive setpoints/buttons.
- Refactor the HMI View tab to show a list of saved graphics with Edit/View; View opens the runtime for the selected graphic.

**Non-Goals:**

- Full CAD-style drawing (lines, shapes drawn from scratch); focus on symbol-based graphics with bindings.
- Version history or branching of graphics (can be a follow-up).
- Offline editor or standalone HMI player; editor and runtime are web-based in the current app.
- Replacing the existing Live Tags / Alarms / Trends tabs; they remain as-is.

## Decisions

**1. Data model: HmiGraphic, HmiGraphicElement, HmiSymbol**

- **HmiGraphic**: id, name, description, width, height (canvas size), metadata (JSON for future options), createdAt, updatedAt, createdById (User). Enables list view, permission checks, and load-by-id for runtime/editor.
- **HmiGraphicElement**: id, graphicId, symbolId (FK to HmiSymbol), x, y, width, height, rotation (degrees), zIndex, props (JSON: bindings and control config). Bindings structure: e.g. `{ tagId, property: "value" | "fill" | "visibility", format? }`; control: `{ type: "setpoint" | "button", tagId?, writeValue? }`. One element = one symbol instance; no nested groups in v1.
- **HmiSymbol**: id, name, category (e.g. "pump", "valve", "tank"), svg (TEXT/LONGTEXT for inline SVG or URL if stored externally), isPredefined (boolean), createdById (nullable for system symbols). Predefined symbols shipped with app; custom symbols created via API with permission.
- Rationale: Keeps graphics queryable, filterable by name/site/owner, and allows future multi-tenancy or tagging. JSON for props avoids schema churn for new binding/control types.

**2. Permission: `scada.edit` for create/update/delete graphics and symbols**

- Reuse or introduce a single permission (e.g. `scada.edit`) that gates: create/update/delete HmiGraphic, create/update/delete custom HmiSymbol. Read (list graphics, get graphic, list symbols) requires `scada.view` only. Rationale: Aligns with existing `scada.view` / `scada.control`; engineers and admins get roles that include `scada.edit`; operators get `scada.view` only so they can only view, not edit.

**3. Editor: SVG canvas with symbol instances as DOM elements**

- Canvas is an SVG root (width/height from graphic). Each element is an `<g>` containing the symbol’s SVG (inline or fetched by symbolId), transformed (translate, scale, rotate) and with event handlers for select/drag/resize. Symbol library is a sidebar listing symbols (predefined + custom); drag onto canvas creates an HmiGraphicElement with default position/size. Property panel shows selected element’s bindings and control type; tag picker uses existing Tag list from API or store. Save persists elements to backend (create/update HmiGraphic and HmiGraphicElements). Rationale: SVG keeps graphics scalable and consistent with “SVG-based” requirement; no need for a full drawing toolkit in v1.

**4. Runtime: Single-graphic viewer with live data**

- Route or tab “View” loads one graphic by id (API returns graphic + elements with symbol SVGs). For each element, resolve tag bindings: read current value/quality from existing real-time store (tagId → value); apply to symbol (e.g. text node for value, fill for alarm state). Buttons and setpoints call existing `writeTag(tagId, value)`. No edit controls in runtime. Rationale: Reuses current real-time and write path; keeps runtime simple and fast.

**5. HMI View tab: List + Edit/View actions**

- Replace current hardcoded content with: (1) List of HmiGraphics (name, description, updated); (2) “New graphic” (if scada.edit); (3) Per row: “View” (opens runtime for that graphic) and “Edit” (opens editor, if scada.edit). “View” can be same page with query param or a dedicated route. Rationale: Single entry point for operators and engineers; clear separation between list, view, and edit.

**6. Symbol storage: Predefined in codebase, custom in DB**

- Predefined symbols: SVG files or inline strings in codebase (or seed data), with `isPredefined: true` and no `createdById`. Custom symbols: user-uploaded SVG stored in HmiSymbol (svg text or URL to blob/store). List API returns both; editor filter can show “All” or “Custom only”. Rationale: Predefined set is fixed and deployable; custom allows plant-specific symbols without code deploy.

**7. No real-time subscription scoping by graphic**

- Runtime subscribes to the same real-time feed as today (e.g. all tags or existing subscription). Only tags referenced by the graphic’s bindings are used for rendering; no backend filter by graphicId. Rationale: Simpler; if the frontend already gets all tag updates, filtering by graphic is client-side. Can optimize later with “subscribe to tag list” per view.

## Risks / Trade-offs

- **Large SVGs or many elements**: Very large graphics could slow editor and runtime. Mitigation: Reasonable limits (e.g. max elements per graphic, max SVG size) in API and UI; pagination or lazy-load for symbol list if needed.
- **Stale bindings**: If a tag is deleted, bindings become invalid. Mitigation: Runtime shows “bad” or “—” for missing tags; editor can validate tagId exists on save and show warnings.
- **Permission granularity**: Only “view” vs “edit” per permission; no per-graphic ACL in v1. Mitigation: Use single `scada.edit`; future change can add graphic-level owner or ACL if needed.
- **Concurrent edit**: No optimistic locking or conflict detection. Mitigation: Last-write-wins; document that only one editor per graphic at a time; optional “updatedAt” check on save in a follow-up.

## Migration Plan

1. **Schema**: Add Prisma models HmiGraphic, HmiGraphicElement, HmiSymbol; run migration. Seed predefined symbols (pump, valve, tank, etc.) and add `scada.edit` to appropriate roles in seed if not present.
2. **APIs**: Implement CRUD for graphics and elements; list/create/update for custom symbols; permission checks on all mutations using `scada.edit` and `scada.view`.
3. **Frontend**: Add graphics list view in HMI View tab; add editor page/route and runtime view route; implement canvas, symbol palette, property panel, and runtime renderer. Refactor scada-panel to use new list + View/Edit.
4. **Deploy**: Standard deploy; no data migration beyond new tables and seed. Rollback: feature flag to show old HMI View if needed; DB tables can remain.

## Open Questions

- Exact binding schema for “alarm state” (e.g. which property of symbol changes on alarm) to be fixed in specs.
- Whether to store custom symbol SVG in DB as text or in object storage (URL in DB); design assumes DB text for v1.
