## ADDED Requirements

### Requirement: Graphics and elements are stored in the database

The system SHALL persist HMI graphics and their elements in the database. Each graphic SHALL have a unique id, name, description, width, height, and creation/update metadata. Each element SHALL reference a symbol, have position and transform (x, y, width, height, rotation, zIndex), and SHALL store bindings and control configuration in a structured format (e.g. JSON).

#### Scenario: Create a new graphic

- **WHEN** an authorized user creates a new graphic with name, dimensions, and optional description
- **THEN** the system SHALL create an HmiGraphic record and SHALL return its id and metadata

#### Scenario: Update graphic and elements

- **WHEN** an authorized user saves changes to a graphic (metadata or elements)
- **THEN** the system SHALL update the HmiGraphic and SHALL create/update/delete HmiGraphicElement records as needed

#### Scenario: Load graphic for view or edit

- **WHEN** a client requests a graphic by id
- **THEN** the system SHALL return the graphic metadata and all elements with their symbol references and props (bindings, control config)

### Requirement: Graphic mutations require edit permission

The system SHALL allow create, update, and delete of HmiGraphic and HmiGraphicElement only for users who have the edit permission (e.g. `scada.edit` or `hmi.edit`). Read (list graphics, get graphic by id) SHALL require only view permission (e.g. `scada.view`).

#### Scenario: Unauthorized user cannot create graphic

- **WHEN** a user without edit permission attempts to create or update a graphic
- **THEN** the system SHALL deny the request and SHALL return an appropriate error (e.g. 403)

#### Scenario: User with view permission can list and open graphics

- **WHEN** a user with view permission requests the list of graphics or a single graphic by id
- **THEN** the system SHALL return the requested data

### Requirement: Elements support tag bindings and control configuration

Each graphic element SHALL support bindings that associate symbol properties (e.g. displayed value, fill color, visibility) with a tag. Elements SHALL support optional control configuration for setpoint (write numeric value) or button (write fixed value or toggle). Binding and control config SHALL be stored in the element’s props (e.g. JSON).

#### Scenario: Element with value binding

- **WHEN** an element has a binding with tagId and property type "value"
- **THEN** the runtime SHALL use the current tag value to render that property (e.g. text or gauge)

#### Scenario: Element with setpoint control

- **WHEN** an element has control type "setpoint" and tagId
- **THEN** the runtime SHALL allow the user to enter a value and SHALL write it to the tag using the existing write API (e.g. writeTag)

### Requirement: Graphics are queryable and listable

The system SHALL provide an API to list saved graphics (e.g. by name, pagination). List response SHALL include at least id, name, description, updatedAt, and optionally createdBy. The system SHALL support loading a single graphic by id with full elements and symbol references for runtime and editor.

#### Scenario: List graphics

- **WHEN** a client with view permission requests the list of graphics (with optional filters or pagination)
- **THEN** the API SHALL return a list of graphics with the required fields

#### Scenario: Get graphic by id

- **WHEN** a client requests a graphic by id
- **THEN** the API SHALL return the full graphic including all elements and their symbol ids and props
