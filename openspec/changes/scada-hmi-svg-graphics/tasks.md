## 1. Database and permissions

- [x] 1.1 Add Prisma models: HmiGraphic (id, name, description, width, height, metadata Json?, createdAt, updatedAt, createdById), HmiGraphicElement (id, graphicId, symbolId, x, y, width, height, rotation, zIndex, props Json), HmiSymbol (id, name, category, svg String, isPredefined Boolean, createdById?, createdAt, updatedAt); add relations and indexes
- [x] 1.2 Run Prisma migration for HMI tables; ensure foreign keys to User and cascade deletes where appropriate
- [x] 1.3 Add permission string `scada.edit` to seed roles (e.g. engineers, admins); ensure `scada.view` exists for view-only roles; document in seed or README
- [x] 1.4 Seed predefined HmiSymbol records: at least pump, valve, tank (with inline SVG and isPredefined true); category and bindable property convention (e.g. data-value, data-fill) documented or encoded in SVG

## 2. Graphics and symbols API

- [x] 2.1 Add API route(s) for graphics: list (GET, pagination/filter by name), get by id (GET), create (POST), update (PUT/PATCH), delete (DELETE); enforce scada.view for read and scada.edit for create/update/delete
- [x] 2.2 Implement create/update to accept graphic metadata and elements array; persist HmiGraphic and HmiGraphicElement (replace elements on update); return full graphic with elements on get
- [x] 2.3 Add API route(s) for symbols: list (GET, all predefined + custom), get by id (GET); create custom (POST), update/delete custom (PUT, DELETE); enforce scada.view for list/get, scada.edit for create/update/delete; reject update/delete for predefined symbols
- [x] 2.4 Add server-side validation: tagId in bindings exists (Tag table), writable tag for setpoint/button; return 400 with clear errors on invalid payload

## 3. Predefined symbol assets

- [x] 3.1 Create or add predefined SVG assets for pump, valve, tank (and optionally pipe, motor); ensure each has a clear bindable value target (e.g. text element with data-binding="value") and optional fill for state; store in seed or static assets and reference in HmiSymbol seed
- [x] 3.2 Document symbol binding convention (e.g. data-binding="value", data-binding="fill") so editor and runtime know which elements to update

## 4. HMI View tab: list and navigation

- [x] 4.1 Replace current HMI View tab content in scada-panel with a list of graphics from the graphics API; show name, description, updatedAt; empty state when no graphics
- [x] 4.2 Add "New graphic" button (visible only if user has scada.edit); navigate to editor with new graphic (unsaved)
- [x] 4.3 Add per-row "View" and "Edit" actions; View opens runtime for that graphic id; Edit opens editor for that graphic id; hide Edit and New when user lacks scada.edit
- [x] 4.4 Add route or view state for runtime (e.g. /scada/graphic/[id] or tab + query) and for editor (e.g. /scada/graphic/[id]/edit or /scada/editor?graphicId=)

## 5. Graphics editor UI

- [x] 5.1 Build editor layout: SVG canvas (sized by graphic width/height), symbol palette sidebar (list from symbols API), property panel for selected element; load graphic by id or start blank for new
- [x] 5.2 Implement drag-from-palette onto canvas: create HmiGraphicElement with symbolId, default x/y/width/height, add to local state and render symbol SVG at position
- [x] 5.3 Implement element selection: click to select; show transform handles or property panel with x, y, width, height, rotation; support move (drag), resize, and rotate (keyboard or handles)
- [x] 5.4 Implement property panel: for selected element, tag binding (tag picker from tags API/store, property: value/fill); control type (none, setpoint, button) with tagId and optional write value; persist to element props in local state
- [x] 5.5 Implement Save: call graphics API (POST create or PUT update) with graphic and elements; handle errors and success (e.g. navigate to list or show toast); implement Cancel to discard and exit without save
- [x] 5.6 Gate editor route/page: redirect or show forbidden if user does not have scada.edit; use existing auth/session and permission check

## 6. Graphics runtime

- [x] 6.1 Implement runtime loader: fetch graphic by id (with elements and symbol refs); resolve symbol SVGs (from symbols API or cache); build render tree (elements with transform and symbol content)
- [x] 6.2 Render canvas: SVG root with graphic dimensions; for each element, render symbol SVG with transform (translate, scale, rotate); apply bindings: read tag value/quality from useRealtimeStore (or tag API), set value into bound property (e.g. text content for value), update on store changes
- [x] 6.3 Apply alarm and quality styling: for each bound tag, if quality BAD or alarm active, set fill/color or class on bound element per design (e.g. red fill for alarm); subscribe to alarms and tag quality
- [x] 6.4 Implement setpoint control: for elements with control type setpoint, render input + Write button; on submit call writeTag(tagId, value) from useRealtimeConnection; show validation (e.g. numeric, min/max from tag if available)
- [x] 6.5 Implement button control: for elements with control type button, render button; on click call writeTag(tagId, configuredValue); support optional toggle or fixed value from element props
- [x] 6.6 Ensure runtime is read-only: no palette, no selection for layout edit, no property panel; only live display and setpoint/button interaction

## 7. Integration and polish

- [x] 7.1 Wire HMI View list to View/Edit: clicking View opens runtime in same tab or new route with graphic id; clicking Edit opens editor with graphic id; back/cancel returns to list
- [x] 7.2 Add loading and error states: loading spinner for list, graphic load, and symbol load; error message for failed API or missing graphic
- [ ] 7.3 Optional: limit elements per graphic or SVG size in API validation; add simple test or smoke check that list, view, and edit flows work with seeded data
