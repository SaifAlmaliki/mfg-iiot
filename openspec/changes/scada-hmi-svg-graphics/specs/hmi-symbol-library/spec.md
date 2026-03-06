## ADDED Requirements

### Requirement: Predefined symbol set is available

The system SHALL ship a predefined set of symbols (e.g. pump, valve, tank, pipe, motor) as SVG content. Each predefined symbol SHALL have a unique id, name, category, and SVG markup. Predefined symbols SHALL be read-only and SHALL NOT require a creating user.

#### Scenario: List includes predefined symbols

- **WHEN** a client requests the symbol library (list)
- **THEN** the API SHALL return all predefined symbols with id, name, category, and SVG (or URL) and SHALL mark them as predefined

#### Scenario: Predefined symbols cannot be updated or deleted

- **WHEN** a client attempts to update or delete a predefined symbol
- **THEN** the system SHALL reject the request and SHALL return an error

### Requirement: Custom symbols can be added by authorized users

The system SHALL allow users with edit permission (e.g. `scada.edit`) to add custom symbols. A custom symbol SHALL have name, category, and SVG content (or reference). Custom symbols SHALL be stored in the database and SHALL be associated with the creating user. Custom symbols SHALL be editable and deletable only by authorized users.

#### Scenario: Create custom symbol

- **WHEN** an authorized user submits a new symbol with name, category, and SVG content
- **THEN** the system SHALL create an HmiSymbol record (isPredefined false) and SHALL return its id and metadata

#### Scenario: List includes custom symbols

- **WHEN** a client requests the symbol library
- **THEN** the API SHALL return both predefined and custom symbols; custom symbols SHALL be identifiable (e.g. isPredefined false)

### Requirement: Symbols expose bindable properties

Symbols SHALL support bindable properties so the editor and runtime can attach tag values or alarm state. At least one property SHALL be defined for value display (e.g. text or numeric). Optional properties SHALL include fill/color for state or alarm highlighting. The system SHALL document or encode which properties are bindable (e.g. in symbol metadata or a convention in SVG elements).

#### Scenario: Value binding target

- **WHEN** a symbol has a designated value property (e.g. data-binding="value")
- **THEN** the editor SHALL allow binding a tag to that property and the runtime SHALL render the current tag value there

#### Scenario: Alarm or state fill

- **WHEN** a symbol has a property usable for state (e.g. fill or data-binding="fill")
- **THEN** the runtime SHALL be able to set that property from tag quality or alarm state (e.g. red for alarm, green for good)

### Requirement: Symbol library API supports list and CRUD for custom symbols

The system SHALL provide an API to list all symbols (predefined + custom), to create a custom symbol (with permission check), and to update and delete custom symbols (with permission check). Predefined symbols SHALL be excluded from update/delete.

#### Scenario: List symbols

- **WHEN** a client with view permission requests the symbol list
- **THEN** the API SHALL return all symbols with id, name, category, SVG (or URL), and isPredefined

#### Scenario: Create custom symbol requires edit permission

- **WHEN** a user without edit permission attempts to create a custom symbol
- **THEN** the system SHALL deny the request (e.g. 403)
