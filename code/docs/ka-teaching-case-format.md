# KA teaching-case file format — Phase 1b

The proposed KA-owned file is `teaching/cases.json`, validated structurally by [`ka-teaching-cases.schema.json`](ka-teaching-cases.schema.json). This step defines a format only; no case data, execution trace, or SWA behavior has been added. The file should start with three cases and may grow to at most eight.

Each case has:

- `case_id`: stable `case-01`, `case-02`, etc.; unique within the file.
- `label`: short, neutral learner-facing name that does not reveal the result.
- `teaching_point`: why this case is included; not a clinical recommendation.
- `fictional: true`: the case contains no real patient information.
- `ka_request`: exactly the six fields accepted by the current KA runtime—`request_id`, `requested_at`, `index_time`, `subject_binding`, `hbot_case_assertions`, and `margolis_first_visit_assessment`. Person, ulcer, care-episode, measurement, attestation, and source-evidence details live here. Do not duplicate the ulcer identifier elsewhere in the case.
- `questionnaire_answers.wagner` and `.burden`: maps keyed by the question IDs supplied by those KOs. These are teaching-harness responses to KO-owned questionnaire callbacks, **not** fields of `ka_request` and not precomputed KO output artifacts. They must be checked against the actual questionnaire definitions when cases are created.
- `expected`: the verified supported gate result, synthesis rule ID, and target classification. This is a test oracle, never an input to the KA computation and never a substitute for a live result.

The format separates what the KA receives, what the constituent KOs collect, and what later validation should observe. Case switching in the SWA must use the `case_id`; the single-ulcer binding comes from `ka_request.subject_binding.ulcer_identifier`. Deeper KA contract, temporal-coherence, source-evidence, question-answer, and outcome validation belong to Steps 1c–1g, not to this structural schema alone.

**KA-source discrepancy to resolve before full validation:** `src/input-validation.js` and `README.md` explicitly exclude `wagner_response_artifact` and `burden_questionnaire_artifact` from the KA request. The embedded `specs/HBOT_Treatment_Target_KA_Schema_Bundle_1_0.json` still lists both as required. This teaching-case format follows the executable runtime contract and keeps questionnaire answers outside `ka_request`; the KA's own schema bundle needs reconciliation by its maintainer.
