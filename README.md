# FDO Bench: make metadata matter

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

The bench includes four clinical Knowledge Objects spanning diabetic foot ulcer severity, prognosis, hyperbaric oxygen treatment decisions, and regimen burden. They are substantive examples rather than empty templates: each gives learners something worth finding, interpreting, trusting, and reusing.

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
