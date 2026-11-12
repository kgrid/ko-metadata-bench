# FDO Bench: make metadata matter

## CMS108 preview on this branch

This branch packages one work-in-progress CMS108 Knowledge Object for educational inspection. Open the local single-file edition at `code/outputs/Knowledge-Object-Workbench.html`, or run the server from `code` with `npm run build` followed by `npm run start -- --port 3112 --hostname 127.0.0.1`.

The file explorer and Metadata Rig expose the packaged sources and core metadata. The KO has no browser Runner, standalone information page, launchable notebooks, graphic abstract, or FAIR facet files. The embedded CLI and test results can be inspected as files. The bench has no assembly in this collection.

The following link opens the existing published bench.

## Published bench
<a href="https://kgrid.org/ko-metadata-bench/code/outputs/Knowledge-Object-Workbench.html" target="_blank" rel="noopener noreferrer">
  FDO Bench, standalone edition
</a>

## Introduction
Metadata is easy to describe and surprisingly hard to understand—until you can see what it does for yourself.

FDO Bench is an interactive teaching workbench for exploring how metadata makes Knowledge Objects carrying computable biomedical knowledge (CBK) **findable, accessible, interoperable, and reusable**. Learners inspect real objects, improve their descriptions, compare perspectives on making objects exhibit the FAIR principles, run supported implementations in the browser, and export the resulting package. Instructors gain a concrete way to move the conversation from abstract principles about metadata to observable consequences from creating and using it.

## What you can do

| Experience | What it reveals |
|---|---|
| Inspect | See the files, structure, identity, and metadata that make up a Knowledge Object |
| Enrich | Add meaningful descriptions, controlled subjects, licenses, evidence, scope, and other FAIR signals |
| Compare | Examine the same object through distinct metadata lenses without flattening their differences |
| Execute | Run compatible JavaScript KOs inside a bounded browser sandbox |
| Export | Download the embedded object—or your working version—with a checksum-backed receipt |

The original workshop collection is available to the regression tests. Tests restore its KO and KA payloads in a temporary fixture and exercise them with the current bench code.

## Why it matters

Good metadata does more than label a file. It explains what an object is, where it belongs, how it can be accessed, what its inputs and outputs mean, what evidence supports it, and where its use should stop.

FDO Bench makes those responsibilities visible. It also keeps them distinct: findability is not interoperability, access is not permission, and successful execution is not proof of fitness for a new purpose. FAIRness emerges from the relationships among these claims—not from a single score or field.

## Run locally

Requires Node.js 22.13 or newer.

```bash
cd code
npm install
npm run dev
```

To verify a production build and run the test suite:

```bash
npm test
```

## Repository map

```text
.
├── code/app/               # Workbench interface and FAIR learning activities
├── code/runner-ready-kos/  # Embedded executable Knowledge Objects
├── code/docs/              # Browser runner contract
├── code/tests/             # Build, behavior, and tooling checks
└── code/outputs/           # Generated standalone artifacts
```

The [acronym-bubble feature contract](code/docs/ACRONYM-BUBBLES.md) records which KO and KA banner names may reveal written-out acronyms, the approved forms, and their shared interaction behavior.

The browser runner is deliberately narrow: compatible KOs expose one JSON-compatible input/output boundary and execute without network, filesystem, or persistent state. The bench supplies the sandbox and controls; each object remains responsible for translating that boundary to its own implementation.

## Scope

FDO Bench is an educational environment. Its clinical examples are provided for learning and evaluation—not for patient care or clinical decision-making. Not ever.

Open an object. Ask what a machine can know about it. Then make that knowledge clearer, more accountable, and more useful.
