# DFU HBO2 Treatment Decision

Node.js package implementing the UHMS Figure 6 DFU/HBO2 treatment decision logic and fail-fast validation semantics.

## Install

```bash
npm install @kgrid/dfu-hbo2-treatment-decision
```

## Exports

- `evaluateInputObject(inputObject)`
- `evaluateSerializedInput(rawJsonText)`
- `evaluateFixture(inputFixture)`

## Interoperability profile (CKS Version 1.0)

The normative object-level interoperability boundary is the exported JavaScript function `evaluateInputObject`, identified by `urn:javascript:function:evaluateInputObject`. It accepts the complete native input object and returns the complete unified nine-field result object. `evaluateSerializedInput` is a serialized-text adapter with parsing and duplicate-property responsibilities; `evaluateFixture` is a testing interface; and the CLI modes are presentation adapters.

- Input semantic model: `https://kgrid.org/cks/dfu-hbo2-treatment-decision/versions/1.0/input-model`
- Unified result semantic model: `https://kgrid.org/cks/dfu-hbo2-treatment-decision/output-models/1.0`
- Runtime schema bundle: `https://kgrid.org/cks/dfu-hbo2-treatment-decision/schema-bundles/versions/1.0`
- Complete invocation-input profile: `https://kgrid.org/cks/dfu-hbo2-treatment-decision/schema-bundles/versions/1.0#input`
- Complete unified-result profile: `https://kgrid.org/cks/dfu-hbo2-treatment-decision/schema-bundles/versions/1.0#result`

The semantic-model IRIs identify meaning; the schema-fragment IRIs identify complete exchanged-object representations. The runtime schema bundle is separate from the canonical test-vector schema.

This amendment remains CKS Version 1.0. It makes the already-published runtime contracts separately addressable and machine-readable without changing clinical logic, validation precedence, mappings, implementation behavior, or test vectors.

## Usage

```js
const {
  evaluateInputObject,
  evaluateSerializedInput,
  evaluateFixture
} = require('@kgrid/dfu-hbo2-treatment-decision');

const result1 = evaluateInputObject({
  dfu_confirmed: 'true',
  wagner_grade: 3,
  acute_surgical_intervention: 'false',
  not_healed_after_30_days: 'true'
});

const result2 = evaluateSerializedInput(
  '{"dfu_confirmed":"true","dfu_confirmed":"false","wagner_grade":3,"acute_surgical_intervention":"false","not_healed_after_30_days":"false"}'
);

const result3 = evaluateFixture({
  kind: 'absent'
});
```

## Testing

```bash
npm test
```

The test suite runs all canonical vectors from:
- `UHMS_Figure_6_DFU_HBO2_Algorithm_CKS_Canonical_Test_Vectors_1_0.json`

It also validates the runtime input and result profiles, confirms coverage of completed, out-of-scope, and error results, and verifies that the runtime and test-vector schemas remain separate artifacts.

## CLI

From this package directory:

```bash
cd collection/dfu-hbo2-treatment-decision
node bin/dfu-hbo2.js --help
```

From the repository root:

```bash
node collection/dfu-hbo2-treatment-decision/bin/dfu-hbo2.js --help
```

Or with npm executable resolution:

```bash
npx dfu-hbo2 --help
```

If `dfu-hbo2` is not recognized in PowerShell, use one of these local options:

```bash
npm run cli -- --help
```

```bash
node bin/dfu-hbo2.js --help
```

Examples:

PowerShell-friendly (recommended):

```bash
npm run cli -- --dfu-confirmed true --wagner-grade 3 --acute-surgical-intervention false --not-healed-after-30-days true
```

JSON inline mode (may require shell-specific escaping):

```bash
npm run cli -- --input '{\"dfu_confirmed\":\"true\",\"wagner_grade\":3,\"acute_surgical_intervention\":\"false\",\"not_healed_after_30_days\":\"true\"}'
```

```bash
npm run cli -- --raw-json '{\"dfu_confirmed\":\"true\",\"dfu_confirmed\":\"false\",\"wagner_grade\":3,\"acute_surgical_intervention\":\"false\",\"not_healed_after_30_days\":\"false\"}'
```

```bash
npm run cli -- --fixture '{\"kind\":\"absent\"}'
```

```bash
npm run cli -- --file input.json
```

## Notebooks

Try this package here:

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/kgrid-objects/FAIR-DO-Workshop/HEAD?urlpath=lab/tree/collection/dfu-hbo2-treatment-decision/dfu_hbo2_binder.ipynb%3Fkernel_name%3Djavascript)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/kgrid-objects/FAIR-DO-Workshop/blob/HEAD/collection/dfu-hbo2-treatment-decision/dfu_hbo2_colab.ipynb)
[![Open In Scribbler](https://img.shields.io/badge/Open%20In-Scribbler-2F9E44?logo=javascript&logoColor=white)](https://app.scribbler.live/?jsnb=https://raw.githubusercontent.com/kgrid-objects/FAIR-DO-Workshop/HEAD/collection/dfu-hbo2-treatment-decision/dfu_hbo2_scribbler.jsnb)
