# DFU HBOT CKS exact conformance fixtures 1.0

This immutable bundle contains exact JSON fixtures for all three CKS capabilities and provider-roster cases.

Validate file integrity:

`python3 run_fixtures.py --validate-bundle`

Run an implementation adapter:

`python3 run_fixtures.py --command "your-adapter-command"`

The adapter receives one canonical fixture object per input line, excluding `expected`, and must emit exactly one JSON result per line. Comparison is structural and exact: no omitted fields, added fields, numeric tolerances, alias substitution, or unordered-array treatment is permitted. JSON object member order is ignored.
