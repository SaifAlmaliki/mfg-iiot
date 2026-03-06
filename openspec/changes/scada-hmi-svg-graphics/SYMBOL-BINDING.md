# HMI Symbol binding convention

Editor and runtime use these conventions to resolve bindings:

- **`data-binding="value"`** — Element (e.g. `<text>`) that displays the current tag value. Editor binds a tag to this property; runtime sets text content (or equivalent) from the real-time tag value.
- **`data-binding="fill"`** — Element used for state/color (e.g. alarm, quality). Runtime sets `fill` or `class` from tag quality or alarm state (e.g. red for alarm/BAD, green for GOOD).

Element `props` in the database store bindings as: `{ bindings: [{ tagId, property: "value" | "fill" }], control?: { type: "setpoint" | "button", tagId?, writeValue? } }`.
