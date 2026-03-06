## ADDED Requirements

### Requirement: Editor provides an SVG canvas for placing symbols

The system SHALL provide an editor UI with an SVG-based canvas whose dimensions match the current graphic (width and height). The editor SHALL allow placing symbol instances from the symbol library onto the canvas. Placed instances SHALL be represented as elements with position (x, y), size (width, height), and rotation.

#### Scenario: Canvas matches graphic dimensions

- **WHEN** the user opens the editor for a graphic (or creates a new one)
- **THEN** the canvas SHALL be rendered with the graphic’s width and height and SHALL allow content within that area

#### Scenario: User can add a symbol to the canvas

- **WHEN** the user drags a symbol from the symbol library onto the canvas (or selects and places)
- **THEN** the system SHALL add a new element to the graphic with default position and size and SHALL display it on the canvas

### Requirement: Editor supports selecting and transforming elements

The system SHALL allow the user to select an element on the canvas. For the selected element, the editor SHALL allow moving (change x, y), resizing (width, height), and rotating. Changes SHALL be reflected in the element model and SHALL persist on save.

#### Scenario: Select and move element

- **WHEN** the user selects an element and drags it to a new position
- **THEN** the element’s x and y SHALL update and the canvas SHALL show the new position

#### Scenario: Resize and rotate element

- **WHEN** the user changes the selected element’s width, height, or rotation (via handles or property panel)
- **THEN** the element’s transform SHALL update and SHALL be saved with the graphic

### Requirement: Editor supports tag bindings and control type per element

The system SHALL provide a property panel (or equivalent) for the selected element. The panel SHALL allow configuring tag bindings: at least one binding that associates a tag (by tagId) with a symbol property (e.g. value, fill). The panel SHALL allow setting the control type to none (display only), setpoint, or button, and SHALL allow specifying tagId and (for button) optional write value. The editor SHALL validate that tagId exists (e.g. from tags API) and SHALL persist bindings and control config in the element’s props.

#### Scenario: Bind tag to value property

- **WHEN** the user selects an element and chooses a tag and property "value" in the property panel
- **THEN** the system SHALL store the binding in the element’s props and SHALL show it in the panel

#### Scenario: Set element as setpoint control

- **WHEN** the user sets the element’s control type to "setpoint" and selects a writable tag
- **THEN** the system SHALL store the control config in the element’s props so the runtime can render a setpoint input and call writeTag

### Requirement: Editor save and cancel

The system SHALL provide Save and Cancel (or equivalent) actions. Save SHALL persist the graphic metadata and all elements to the backend using the graphics API (create or update). Cancel SHALL discard unsaved changes and SHALL leave the editor without persisting. The editor SHALL be gated by edit permission; users without it SHALL not see or access the editor.

#### Scenario: Save updates graphic

- **WHEN** the user clicks Save with valid graphic and elements
- **THEN** the system SHALL call the graphics API to create or update the graphic and elements and SHALL show success or handle errors

#### Scenario: Edit permission required

- **WHEN** a user without edit permission attempts to open the editor or create a new graphic
- **THEN** the system SHALL deny access (e.g. redirect or show message) and SHALL not allow editing

### Requirement: Editor has access to symbol library and tag list

The editor SHALL load the symbol library (predefined + custom) for the palette and SHALL load the list of tags (from existing tags API or store) for binding configuration. The editor SHALL display symbols in a usable form (e.g. thumbnail or name list) and SHALL allow searching or filtering tags by name or id.

#### Scenario: Symbol palette shows all symbols

- **WHEN** the editor loads
- **THEN** the symbol palette SHALL display available symbols (predefined and custom) so the user can drag or select to add to the canvas

#### Scenario: Tag picker shows tags

- **WHEN** the user configures a binding or control
- **THEN** the editor SHALL show a list (or searchable picker) of tags so the user can select tagId
