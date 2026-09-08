# Wagner Knowledge Object

This archive is the Wagner Knowledge Object. It contains the Clinical Knowledge
Summary materials, the unchanged JavaScript questionnaire and scoring
implementation, and the Knowledge Object's published metadata.

## Contents

- `implementation/` — JavaScript capability, package metadata, and tests.
- `interoperability.metadata.txt` — the published interoperability boundary.
- `metadata.json`, `findability.metadata.txt`, and
  `accessibility.metadata.txt` — other Knowledge Object metadata.
- Clinical Knowledge Summary documents and supporting demonstrations.

The `implementation/src/knowledge-object.js` module exposes the published
`run(input)` boundary and delegates to the existing scorer.

This archive intentionally contains no interoperability exercise state,
simulation manifests, exercise profiles, exercise examples, state presets, or
teaching harnesses. Those materials are distributed separately and are not part
of this Knowledge Object.
