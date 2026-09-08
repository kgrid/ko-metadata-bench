# HBOT Treatment Decision CKS Version 1.0 Amendment Validation Report

Date: 2026-08-23

## Outcome

PASS. The interoperability amendment remains CKS Version 1.0 and introduces no clinical or computational behavior change.

## Versioning rationale

The amendment publishes stable identifiers and machine-readable profiles for contracts already defined in the Version 1.0 CKS, implemented by `evaluateInputObject`, and exercised by the canonical Version 1.0 vectors. It does not alter clinical scope, decision branches, field meanings, validation precedence, result mappings, or implementation output. All new CKS, schema, documentation, metadata, and interoperability identifiers therefore retain Version 1.0.

## Behavioral preservation

- Existing canonical behavioral tests: 51 passed, 0 failed.
- Total automated tests after adding five interoperability test groups: 57 passed, 0 failed.
- `src/decision.js` is byte-for-byte unchanged; SHA-256 before and after: `60700c8c57dbf876d17ae00930496f8c416c9575527518c9517c33c447e24a91`.
- Canonical test-vector artifact is byte-for-byte unchanged; SHA-256 before and after: `68be869ee56f2c49aa821dbae218e95913dbd76295dda86d113e4975ef65dbdd`.

## JSON Schema validation

Validated with Python `jsonschema` 4.17.3 using its Draft 7 validator.

- Runtime schema bundle is a valid JSON Schema Draft 7 schema.
- `#input` and `#result` resolve as distinct definitions within the Version 1.0 bundle.
- Original test-vector schema is a valid JSON Schema Draft 7 schema.
- The unchanged 51-vector artifact validates against its own test-vector schema.
- 10 valid canonical native-object inputs validate against `#input`.
- 29 canonical invalid native-object inputs are rejected by `#input` and remain handled according to the CKS.
- All 40 applicable native-boundary return observations validate against `#result`.
- Completed, out-of-scope, and error result classes are covered.
- Altered result constants and extra-field shapes are rejected.

The 11 raw-JSON vectors remain tests of the separate serialized-text adapter. Their duplicate-property parsing responsibilities are intentionally not represented as native JavaScript object inputs to `evaluateInputObject`.

## Interoperability metadata validation

`interoperability.metadata.txt` passed the `create-interoperability-metadata` Turtle syntax and structural validator using RDFLib 7.6.0. The validator confirmed the required semantics, profiles, interface, identifier, and version facets.

## Document QA

The amended DOCX was rendered to 26 page images and visually inspected. The new Section 10 follows the existing CKS typography, headings, margins, header/footer, and page flow. No clipping, overlap, missing content, or unintended version change was observed.
