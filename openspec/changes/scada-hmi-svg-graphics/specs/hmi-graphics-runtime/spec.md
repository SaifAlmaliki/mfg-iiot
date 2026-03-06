## ADDED Requirements

### Requirement: Runtime loads and renders a saved graphic with live data

The system SHALL provide a runtime viewer that loads a graphic by id (from the graphics API) and SHALL render all elements using their symbol SVGs and transforms. For each element with tag bindings, the runtime SHALL resolve the current tag value (and quality) from the existing real-time data source (e.g. useRealtimeStore or tag API) and SHALL apply the value to the bound symbol property (e.g. text for value, fill for state/alarm).

#### Scenario: Load graphic and render elements

- **WHEN** the user opens the runtime for a graphic id (e.g. via "View" from the list)
- **THEN** the system SHALL fetch the graphic and elements, SHALL resolve symbol SVGs, and SHALL render the canvas with all elements at correct positions and transforms

#### Scenario: Live value updates

- **WHEN** a tag value updates in the real-time store and an element is bound to that tag’s value property
- **THEN** the runtime SHALL update the displayed value for that element without full reload

### Requirement: Runtime supports alarm and quality highlighting

The system SHALL use tag quality and alarm state when rendering elements. For elements bound to a tag, the runtime SHALL apply visual indication (e.g. fill color or border) when the tag’s quality is BAD or when an alarm is active for that tag. The exact mapping (e.g. red fill for alarm) SHALL be defined in the runtime or symbol binding.

#### Scenario: Alarm state changes appearance

- **WHEN** a tag has an active alarm and an element is bound to that tag (value or state)
- **THEN** the runtime SHALL show a distinct visual state (e.g. red or flashing) for that element according to the design/spec

#### Scenario: Quality bad shown

- **WHEN** a tag’s quality is BAD and an element displays that tag
- **THEN** the runtime SHALL indicate bad quality (e.g. color or label) so the operator can tell data is invalid

### Requirement: Runtime supports interactive setpoints and buttons

For elements configured as setpoint or button controls, the runtime SHALL render an interactive control (e.g. input + write button for setpoint, button for button). When the user submits a setpoint value or clicks a button, the runtime SHALL call the existing tag write API (e.g. writeTag(tagId, value)) with the configured tagId and value. The runtime SHALL NOT allow editing the graphic layout or bindings; it SHALL only render and handle these controls.

#### Scenario: Setpoint write

- **WHEN** the user enters a value in a setpoint control and confirms (e.g. clicks Write)
- **THEN** the runtime SHALL call the write API for the element’s configured tagId with the entered value

#### Scenario: Button write

- **WHEN** the user clicks a button control configured with a tag and optional write value
- **THEN** the runtime SHALL call the write API for that tag with the configured value (or toggle if specified)

### Requirement: HMI View tab shows list of graphics with View and Edit

The system SHALL replace the current hardcoded HMI View content with a list of saved graphics. Each list item SHALL show at least the graphic name and SHALL offer a "View" action that opens the runtime for that graphic and a "Edit" action that opens the editor for that graphic. The Edit action SHALL be visible only to users with edit permission. The list SHALL offer a "New graphic" action (or equivalent) for users with edit permission. View SHALL open the selected graphic in the runtime with live data.

#### Scenario: List shows all graphics

- **WHEN** the user opens the HMI View tab
- **THEN** the system SHALL display a list of saved graphics (from the graphics API) with name and optional description

#### Scenario: View opens runtime

- **WHEN** the user clicks "View" on a graphic
- **THEN** the system SHALL open the runtime for that graphic id and SHALL render it with live tag data

#### Scenario: Edit opens editor for permitted users

- **WHEN** a user with edit permission clicks "Edit" on a graphic
- **THEN** the system SHALL open the editor for that graphic so the user can modify layout and bindings

#### Scenario: Edit hidden without permission

- **WHEN** a user without edit permission views the HMI View list
- **THEN** the system SHALL NOT show "Edit" or "New graphic" (or SHALL show them disabled with appropriate messaging)

### Requirement: Runtime does not allow editing layout or bindings

The runtime SHALL be read-only for the graphic structure. The user SHALL NOT be able to add, remove, or move elements, or change bindings or control config from the runtime. Only live data display and configured setpoint/button actions SHALL be available.

#### Scenario: No edit controls in runtime

- **WHEN** the user is in the runtime view
- **THEN** the system SHALL NOT show editor tools (e.g. symbol palette, property panel, drag handles for layout) and SHALL only allow interaction with setpoint/button controls as configured
