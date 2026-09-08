# FAIR Knowledge Object Runner Contract 1.0

This contract supports browser execution of JavaScript implementations of computable knowledge specifications embedded in Knowledge Objects. It does not define a general-purpose language runtime.

## Runner package

An executable Knowledge Object supplies two files:

```text
runner/
  runner.manifest.json
  runner.bundle.js
```

The manifest contains exactly four fields:

```json
{
  "runnerVersion": "1.0",
  "knowledgeObjectId": "workshop-ko-1",
  "knowledgeObjectVersion": "1.0",
  "bundle": "runner/runner.bundle.js"
}
```

`bundle` must be a relative path inside the Knowledge Object and must end in `.js`. URLs, absolute paths, empty path segments, and parent-directory traversal are invalid.

## JavaScript boundary

The browser bundle must install one global object:

```javascript
globalThis.FAIR_KO_RUNNER = {
  async run(input) {
    return result;
  }
};
```

`run` may return a JSON-compatible result directly or through a Promise. Input and output must be transferable through the browser structured-clone algorithm. A bundle must not require Node.js globals, filesystem access, terminal input, or network access.

The bundle owns translation from this single boundary to its internal CKS implementation. The Bench owns the sandbox, timeout, input presentation, result presentation, and user controls.

## Host messages

The host and sandbox exchange five message types:

```text
runner:init
runner:ready
runner:run
runner:result
runner:reset
```

Every message contains:

```json
{
  "runnerVersion": "1.0",
  "type": "runner:ready",
  "sessionId": "host-generated-session-id"
}
```

`runner:run` and `runner:result` also contain a host-generated `requestId`. A result is either:

```json
{
  "ok": true,
  "output": {}
}
```

or:

```json
{
  "ok": false,
  "error": {
    "code": "EXECUTION_FAILED",
    "message": "The knowledge object could not complete this request."
  }
}
```

These fields are added to the common message envelope. Error messages must not expose JavaScript stacks or host details.

After `runner:reset`, the host replaces the sandbox with a fresh instance. No persistent state is part of this contract.

## Deliberate exclusions

Contract 1.0 does not support Python or other languages, package installation at runtime, network services, RDF-derived forms, interface simulation, persistent execution state, or KO-specific display rules.
