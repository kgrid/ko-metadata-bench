# Wagner interoperability exercise kit

This package is a standalone educational interoperability simulation for the Meggitt-Wagner Classification Knowledge Object.

It demonstrates how a computational capability can progress from an executable but opaque boundary to an explicitly specified interoperability boundary.

The exercise does not modify the Wagner Knowledge Object, reproduce its clinical logic, or directly invoke its implementation. A host application may associate the exercise with an external Wagner Knowledge Object for simulation purposes.

## Target Knowledge Object

This exercise is specifically and exclusively configured for:

- Knowledge Object identifier: `meggitt-wagner-cks`
- Knowledge Object version: `1.0`
- Specification:

  `https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0`

The exercise artifacts, profiles, semantic descriptions, examples, bindings, and interface specification are Wagner-specific teaching materials. This package is not a generic interoperability template.

## Educational objective

The exercise distinguishes four states:

### State 0 — Boundary opaque

The computational capability is available, but its interoperability boundary is not explicitly described.

A host can supply data to the simulated capability and receive a result, but the exercise has not yet declared:

- What the input and output mean
- Which formal data-object profiles govern them
- How those objects bind to an interface
- How the operation is invoked
- How successful and unsuccessful outcomes cross the boundary

Execution alone does not establish interoperability.

### State 1 — Semantics added

State 1 adds explicit meanings for the input, output, and their constituent elements.

The learner can determine:

- What the completed questionnaire response represents
- What each question represents
- What each response value means
- What the classification result represents
- What each result property and value means

The data now have declared meaning, but complete data-object specifications and an actionable interface specification are not yet available.

### State 2 — Data object specifications added

State 2 adds formal profiles for the complete input and output objects.

The learner can determine:

- Required properties
- Property types
- Array cardinalities
- Permitted values
- URI requirements
- Input-profile conformance
- Output-profile conformance

The input and output are now formal data objects.

However, State 2 does not yet specify how the input object is supplied to the capability, how the capability is invoked, where the output object is returned, or how failures are delivered.

State 2 defines the objects but does not connect them through an operational interface.

### State 3 — Interface specification added

State 3 adds an aggregated interface specification.

The interface specification declares:

- The operation identifier
- The interaction style
- The implementation language expected by the teaching contract
- The callable member
- The invocation signature
- An invocation example
- Whether invocation is asynchronous
- The completion mechanism
- The input binding
- The successful-output binding
- The error-delivery binding
- The successful outcome
- The error-object schema
- The defined error outcomes
- Representative success and error examples
- The interface-specification identity and version
- The target Knowledge Object identity and version

State 3 connects the formal objects introduced at State 2 to a declared interaction:

```javascript
await knowledgeObject.run(input)
```

Under this teaching specification:

- An object conforming to `CompletedQuestionnaireResponseProfile` is supplied as the required `input` function argument.
- The operation is invoked as `run(input)`.
- Successful asynchronous completion resolves with an object conforming to `WagnerAnalysisResultProfile`.
- A failed interaction rejects with a structured error described by the interface specification.

State 3 therefore adds an operation contract. It does not change the input and output data objects introduced at State 2; it specifies how those objects cross the computational boundary.

## Artifact map

### Exercise configuration

`interoperability.exercise.json`

Identifies:

- The exercise type
- The exercise kit
- The target Knowledge Object
- The target version
- The target specification
- The active interoperability-facet state

The three facets are independently represented as:

- `semantics`
- `profiles`
- `interface`

Each facet accepts either `complete` or `missing`.

### Semantic descriptions

`semantics/input-semantics.json`

Describes the meaning of:

- The complete input
- Every input property
- Every Wagner questionnaire item
- Every supported response value

`semantics/output-semantics.json`

Describes the meaning of:

- The complete output
- Every output property
- Every analysis status
- Every Wagner score
- Every grade label

These artifacts provide the information introduced at State 1.

### Data object profiles

`profiles/CompletedQuestionnaireResponseProfile.json`

Defines the formal structure and constraints of the accepted input object.

`profiles/WagnerAnalysisResultProfile.json`

Defines the formal structure and constraints of the successful output object.

These artifacts provide the information introduced at State 2.

### Aggregated interface specification

`interface/interface.json`

This is the primary artifact introduced at State 3.

It aggregates the complete teaching interface specification, including:

- Interface identity and version
- Target Knowledge Object
- Invocation method
- Input binding
- Output binding
- Error binding
- Successful outcome
- Error schema
- Error definitions
- Inline success and error examples

All information introduced specifically by State 3 is intentionally kept together in this file.

This aggregation is deliberate. In a production system, interface content might be divided among schemas, reusable components, examples, and other referenced artifacts. For this teaching exercise, keeping the interface specification together makes the transition from State 2 to State 3 easier to inspect and understand.

The interface specification follows principles familiar from OpenAPI descriptions without representing the Wagner capability as an HTTP or RESTful service.

It uses interface-neutral concepts:

- Operation
- Invocation
- Input binding
- Successful output
- Error outcome
- Delivery mechanism
- Contract identity
- Contract version

### Execution simulation

`execution/raw-execution.json`

Describes the deliberately opaque State 0 execution path.

The raw execution simulation demonstrates that a capability may accept an object and return a result even when its interoperability boundary has not been published.

`execution/raw-harness.js`

Calls a host-supplied private executor.

It does not interpret the input, validate a public contract, or invoke the Wagner implementation directly.

`execution/contract-execution.json`

Describes the State 3 contract simulation and references:

```text
interface/interface.json
```

The execution manifest identifies:

- The external target binding
- The input profile and example
- The output profile and example
- The aggregated interface specification

The interface specification remains authoritative for invocation, bindings, successful completion, and errors.

`execution/contract-harness.js`

Demonstrates the declared calling convention against a host-supplied external Knowledge Object:

```javascript
await knowledgeObject.run(input)
```

The harness uses dependency injection to preserve separation between this exercise package and the target Knowledge Object.

It does not contain the Wagner implementation.

### Examples

`examples/raw-input.json`

Provides an input instance for the opaque execution simulation.

The object may have an observable structure, but State 0 deliberately withholds its semantic, profile, and interface descriptions.

`examples/raw-output.json`

Provides an opaque result for the State 0 simulation.

`examples/valid-input.json`

Provides an example object conforming to `CompletedQuestionnaireResponseProfile`.

`examples/expected-output.json`

Provides an example successful result conforming to `WagnerAnalysisResultProfile`.

The State 3 interface specification also contains inline examples of successful and unsuccessful interface outcomes. Those inline examples are intentionally kept with the operation contract so the learner does not need to reconstruct the interface specification from separate error files.

### State presets

`states/state-0-missing-all.json`

```text
Semantics: missing
Profiles: missing
Interface: missing
```

`states/state-1-semantics-complete.json`

```text
Semantics: complete
Profiles: missing
Interface: missing
```

`states/state-2-profiles-complete.json`

```text
Semantics: complete
Profiles: complete
Interface: missing
```

`states/state-3-interface-complete.json`

```text
Semantics: complete
Profiles: complete
Interface: complete
```

Additional state files may represent independent facet combinations. The implementation should not assume that completion is always sequential, even though the primary teaching progression moves from State 0 through State 3.

### Tests

`test/standalone.test.js`

Verifies:

- Raw execution uses only a host-supplied executor
- Contract execution uses an externally supplied Knowledge Object
- Referenced exercise artifacts remain inside the exercise package
- Exercise artifacts target the intended Wagner Knowledge Object and version
- Progressive and independently degraded facet states are supported
- State 3 supplies one aggregated interface specification
- The complete invocation method is declared
- Input and output profiles are bound to specific interface locations
- Success is delivered through a resolved promise
- Errors are delivered through rejected promises
- The error schema and error definitions remain consistent
- Every declared error has a valid inline example
- The interface specification contains no Wagner implementation or clinical classification logic

Run the package tests with:

```bash
npm test
```

## Declared operation

The State 3 teaching contract declares this JavaScript invocation:

```javascript
const output = await knowledgeObject.run(input);
```

The parts of that interaction have precise roles.

### Input binding

`input` is:

- The first function argument
- Required
- Passed as an object value
- Governed by `CompletedQuestionnaireResponseProfile`

The input binding connects the formal input data object to a specific location in the callable interface.

### Invocation

`run(input)` is:

- The declared operation
- A JavaScript function invocation
- Asynchronous
- Completed through a promise

The invocation declaration tells a consumer how to request the computation.

### Successful output binding

`output` is:

- Obtained from the resolved promise
- Governed by `WagnerAnalysisResultProfile`

The output binding connects successful completion to the formal output data object.

### Error binding

An unsuccessful interaction is:

- Delivered through a rejected promise
- Represented by the structured error schema contained in `interface/interface.json`

The interface specification defines three teaching error outcomes.

#### `INVALID_INPUT`

The supplied object does not conform to `CompletedQuestionnaireResponseProfile`.

Phase:

```text
input-validation
```

#### `CONTRACT_MISMATCH`

The requested interface, Knowledge Object version, or data-object profile version is incompatible with the declared contract.

Phase:

```text
contract-binding
```

#### `EXECUTION_FAILED`

The capability was invoked through the declared interface but did not complete normally.

Phase:

```text
invocation
```

These error definitions belong to the teaching interface specification. They should not be interpreted as claims about errors currently emitted by the underlying Wagner implementation unless that implementation independently adopts the same contract.

## Simulation boundary

This package supports an educational simulation.

It deliberately does not:

- Contain the Wagner implementation
- Reproduce the Wagner classification algorithm
- Modify the target Knowledge Object
- Modify `interoperability.metadata.txt`
- Claim that the underlying implementation emits the teaching error objects
- Establish universal interoperability
- Execute untrusted code described by metadata

The host application controls execution and may provide a simulation binding for the identified target.

The exercise artifacts describe what the learner is allowed to see at each state. They do not alter the computational capability.

## Central teaching distinction

The progression can be summarized as:

```text
State 0
A capability can run.

State 1
Its input and output have declared meanings.

State 2
Its input and output are formally specified data objects.

State 3
Those data objects are connected through a versioned interface specification
that defines invocation, bindings, success, and failure.
```

The principal lesson is:

> Execution is not interoperability. A computational capability becomes interoperably specified when its meanings, exchanged data objects, and operational interface boundary are made explicit.