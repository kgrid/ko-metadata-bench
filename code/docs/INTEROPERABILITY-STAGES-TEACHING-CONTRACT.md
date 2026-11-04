# Interoperability Stages teaching contract

This contract governs the meaning of the SWA's **Interoperability Stages** lesson in both editions. It records the teaching progression before the Stages view is redesigned. It is a presentation contract, not a replacement for a Knowledge Object's interoperability metadata, CKS, or interface specification.

## Integration lesson: an agreement between systems

The lesson concerns two parties: a **requesting system** that wants to use a computable capability, and the **Knowledge Object (KO)** that offers it. An input must cross from the requester to the KO, and a result or failure must cross back. The three metadata dimensions progressively describe that exchange. They are not three isolated properties of the KO, and observing a result without an agreed description does not make the systems interoperable.

For the requesting system to integrate the capability, it must be able to establish all of the following from the applicable published descriptions and the resources they identify:

| Need at the system boundary | What the requester must know | Metadata dimension |
| --- | --- | --- |
| Interpret information | What the input, output, and their constituent values mean, so it does not equate similarly shaped but differently meant data. | **Semantics** |
| Prepare and receive objects | The complete input and output structures, required fields, value constraints, and profile identities, so it can construct and check whole objects rather than guess from example values. | **Data object profiles** |
| Invoke the capability | Which operation is offered, how to call it, and where the input and output objects bind. | **Interface** |
| Handle the response | What counts as successful completion and how declared failures are delivered and recognized. | **Interface**, interpreted using the output meanings and profiles |

A **published agreement** is a set of descriptions the KO makes available for another system to inspect and use. Published RDF may identify meanings, profile resources, and an action target without containing every rule, signature, or example inline; a requester must resolve the referenced material to use it. Publication alone establishes neither that a particular requester understands the agreement nor that the KO actually behaves as described. Conversely, an observed example does not establish the agreement.

**Demonstrated interoperability** would require evidence from an actual requester and KO following the applicable contract: the requester constructs an appropriate input, invokes the KO through the specified interface, receives a real result or failure, and interprets it according to the declared meanings and profiles. Agreement on identifiers, versions, and the chosen invocation environment must hold for that exchange. The Stages exercise does **not** perform this demonstration: its auxiliary descriptions and fixture replay illustrate what the agreement would enable, while the KO implementation is not invoked. The final stage therefore means **integration is sufficiently described for an attempt**, not “integration succeeded” or “interoperability certified.”

## One example exchange across the stages

Follow one completed Wagner questionnaire response through the primary path. The exercise's `examples/raw-input.json` and `examples/valid-input.json` are **identical**: the same specification and response-model identifiers, Q01–Q10 question IDs, and ten answers (including `Q08 = "X"`). Stage selection does not change the example request or recompute its answers.

The two supplied response fixtures are **not identical representations**. `examples/raw-output.json` contains only `{ "output1": "2" }` for States 0–1. `examples/expected-output.json` supplies a structured result for States 2–3, retaining the same question IDs and answers and reporting `analysis_status: "grade_computed"`, `wagner_score: [2]`, and `grade_label: ["Deep ulcer"]`. These fixtures agree on grade **2**, but the structured output is an additional *supplied example*, not a transformation the Stages view computed from the raw output. Nothing in fixture replay demonstrates that the actual KO returned either example.

| Stage | Request example | Response example | What changes in the lesson |
| --- | --- | --- | --- |
| **Unexpressive** | Raw questionnaire response | Raw `output1: "2"` | Values are observable without disclosed meanings, profiles, or interface. |
| **Semantics** | The same raw request | The same raw response | Meanings are supplied; the example values do not change. |
| **Data object profiles** | The identical request, now shown against its complete profile | The structured result fixture with score 2 | The response *representation* changes as the lesson introduces complete object profiles; it is not merely the raw output with annotations. |
| **Interface** | The same profiled request | The same structured result fixture | The described invocation, bindings, and outcomes are added; the KO is still not invoked by the exercise. |

The requesting-system story may call this one **example exchange** because the request is identical and the supplied responses correspond at the grade level. It must not call the two response files “the same output,” assert that one was generated from the other, or imply that they are observed results of a live KO run. A later lesson may use a genuinely live exchange, but it must identify that as different evidence.

## Baseline and three dimensions

**Unexpressive** is State 0, the comparison baseline. A capability may accept input and produce output while the exercise withholds an explicit description of its interoperability boundary. Unexpressive is **not** a fourth interoperability dimension, and an observed result alone does not establish interoperability.

The three dimensions are:

1. **Semantics:** what the accepted input, produced output, and their constituent values mean.
2. **Data object profiles:** the complete structures and constraints of the exchanged input and output objects.
3. **Interface:** the operation, invocation, input/output bindings, successful completion, and error delivery by which those objects cross the boundary.

These are the SWA's existing `INTEROPERABILITY_FACETS` and the exercise kit's `semantics`, `profiles`, and `interface` facets. The Stages controls use **Unexpressive**, **Semantics**, **Data object profiles**, and **Interface**. Unexpressive names the baseline, not a fourth dimension. The exercise kit's machine keys remain `semantics`, `profiles`, and `interface`.

## Primary teaching path

| Stage | Baseline or newly revealed dimension | Semantics | Data object profiles | Interface | What the learner can establish |
| --- | --- | --- | --- | --- | --- |
| 0 — Unexpressive | Baseline | Withheld | Withheld | Withheld | Input and output can be observed, but their meanings, formal profiles, and operational contract are not exposed. |
| 1 | Semantics | Revealed | Withheld | Withheld | The input, output, and their elements have declared meanings; complete object specifications and invocation are still not exposed. |
| 2 | Data object profiles | Retained | Revealed | Withheld | Complete input/output profiles and constraints are available in addition to meaning; the objects are not yet bound through a declared operation. |
| 3 | Interface | Retained | Retained | Revealed | A versioned operation contract binds the profiled input and output to invocation, success, and failure. |

The primary lesson is **cumulative disclosure**: each stage retains the dimensions revealed earlier. The display rule is exact: State 0 may show observed values but no descriptions of meaning, complete object profiles, or interface; State 1 adds input/output meanings; State 2 keeps those meanings visible and adds complete input/output object profiles and their constraints; State 3 keeps meanings and profiles visible and adds the declared operation, invocation, input/output bindings, success, and failure. Changing stages changes the disclosed description, not the KO's published metadata. State 3 adds an interface; it does not change the meanings or data objects introduced in States 1 and 2. The central distinction remains: **execution is not interoperability**.

## Persistent boundary diagram

The Stages dialog keeps two endpoints above the stage-specific content: **Requesting system** and **System hosting the KO**, with the KO visibly contained in the latter. The upper path carries **Input / request →** to the host; the lower path carries **← Output / response** back to the same requester. The endpoints are illustrated as systems, not actionable buttons. They describe parties and directions in the example exchange, not three categories of interoperability or an assertion that two live servers are running. The arrows stay visible even when the Interface description is withheld; they do not assert that an invocation took place.

One shared row of **Semantics**, **Data object profiles**, and **Interface** markers describes the *whole system-to-system boundary*, rather than attaching each dimension to a party or treating a dimension as the name of a position. The marker state is cumulative: revealed markers remain revealed at every later stage. Withheld dimensions use quiet dashed markers; revealed dimensions use the SWA's dark filled treatment. At narrow widths the two systems remain distinct, with both directional paths between them and the same three markers below. The diagram shows **what the exercise discloses**, not a live KO invocation, an absence of undisclosed published metadata, or proof of integration.

## Independence outside the primary path

The three facet states are independently represented as `complete` or `missing`. The kit also includes nonsequential presets, such as an interface present while profiles are missing. Those are legitimate facet combinations, not errors and not alternative definitions of the four primary stages. A redesigned Stages view may teach the cumulative path without asserting that every KO must acquire its facets in that order or that one complete facet implies another.

“Complete” here means the selected facet is supplied in the exercise state. It is not a universal interoperability certification. In particular, an available interface simulation in a nonsequential state must not be described as a fully specified three-dimensional boundary when another facet is missing.

## Source and simulation boundaries

- The KO's `interoperability.metadata.txt` is the **published metadata record**. It describes the KO's three facets and remains unchanged when a learner selects a teaching stage.
- The embedded `auxiliary/aux-interoperability-exercise/` package supplies **teaching artifacts and state presets**: semantic descriptions, input/output profiles, an interface specification, examples, and simulations. Its primary presets are `state-0-missing-all.json`, `state-1-semantics-complete.json`, `state-2-profiles-complete.json`, and `state-3-interface-complete.json`.
- The SWA's host-supplied simulation binding **replays fixtures**. It does not import or invoke the KO implementation, reproduce the KO's clinical logic, or establish that the KO emits the exercise's example errors. State 0's observable input/output is therefore an educational comparison, not a claim of live KO execution in the Stages view.

The published record, exercise artifacts, and simulated observations must remain distinguishable in subsequent UI work. The Metadata Rig filters are named **Object References** and **Specified Interface** only in the Rig; neither is a Stages dimension or control.

The provenance distinctions above remain part of this teaching contract, but they do not require a separate source block in the Stages dialog. Future source cues should be placed only where a particular declaration, exercise detail, or simulated observation could otherwise be confused with another.

### Metadata Rig filter scope

The filters act only on the selected `interoperability.metadata.txt` graph. Let *root* be its first named-node subject; the table lists the exact selected triples. They select statement IDs independently; with both buttons on, the displayed result is their union. An absent triple contributes nothing.

| Rig filter | Selected relationships | Not selected by this filter |
| --- | --- | --- |
| **Specified Interface** | For each root `schema:potentialAction` pointing to a blank-node action: that root-to-action triple, plus the action's `schema:target` triple, if present. | The action's `schema:object`, `schema:result`, name, invocation details, and any exercise-kit `interface.json` fields. |
| **Object References** | Root `schema:object` and `schema:result` triples; for each root `dcterms:conformsTo` pointing to a blank-node profile binding: that link plus the binding's `schema:object` and `schema:result` triples. | The `schema:potentialAction` / `schema:target` route, action-node object/result triples, profile constraints, and example object values. |

Thus **Specified Interface** is a narrow action/target RDF slice, not the complete Interface dimension; **Object References** is a narrow object/profile-reference slice, not the complete Semantics or Data object profiles dimension. Filter labels describe what the Rig shows, not all the facts available to the Stages lesson.

## Alignment with existing SWA records

This contract preserves the teaching sequence and the independent-facet caveat stated in the embedded DFU Severity Score KO interoperability exercise README. Its stage matrix matches the embedded four primary state presets and the SWA's current `stateFor` mapping in `app/page.tsx`. Its three dimensions match `INTEROPERABILITY_FACETS` in that file and the facet keys validated by `app/interoperability-exercise.js`. Its simulation limit matches `app/interoperability-simulation.js`, whose fixture-replay result explicitly reports that the implementation was not invoked.

This document defines **meaning only**. It does not yet change stage labels, layout, filters, source navigation, or the simulation.
