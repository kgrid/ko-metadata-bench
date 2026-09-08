# DFU HBOT Bounded Regimen and Execution Burden

This package implements the three-part architecture from the attached specification:

1. Regimen Range
2. Burden Questionnaire Logic
3. Burden Response Analysis

## Notebooks

Try this package here:

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/kgrid-objects/FAIR-DO-Workshop/HEAD?urlpath=lab/tree/collection/dfu-hbot-bounded-regimen-and-execution-burden/dfu-hbot_binder.ipynb%3Fkernel_name%3Djavascript)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/kgrid-objects/FAIR-DO-Workshop/blob/HEAD/collection/dfu-hbot-bounded-regimen-and-execution-burden/dfu-hbot_colab.ipynb)
[![Open In Scribbler](https://img.shields.io/badge/Open%20In-Scribbler-2F9E44?logo=javascript&logoColor=white)](https://app.scribbler.live/?jsnb=https://raw.githubusercontent.com/kgrid-objects/FAIR-DO-Workshop/HEAD/collection/dfu-hbot-bounded-regimen-and-execution-burden/dfu-hbot_scribbler.jsnb)

## Install

```bash
npm install
```

## Run Tests

```bash
npm test
```

## CLI

Run directly from your project:

```bash
npx dfu-hbot-burden
```

Or after global install:

```bash
npm install -g @dfu-hbot/bounded-regimen-and-execution-burden
dfu-hbot-burden
```

The CLI prompts for the four questionnaire inputs:

1. Q01: Where will you receive hyperbaric oxygen therapy?
2. Q02: About how many miles is it one way from where you usually start to this hyperbaric oxygen therapy location?
3. Q03: About how long does that trip usually take one way?
4. Q04: Thinking about receiving treatment at [confirmed location name] five weekdays per week for approximately 6-8 weeks - and apart from the miles and travel time you reported - how much difficulty do you expect with attending the scheduled treatments?

For conformance, users enter canonical response values directly:

1. Q01 as `hyperbaric_oxygen_therapy_location` provider IRI (for example `https://kgrid.org/cks/dfu-hbot-burden/providers/e-001`)
2. Q02 as numeric `one_way_miles`
3. Q03 as numeric `one_way_travel_minutes`
4. Q04 as `weekday_attendance_difficulty` in `{none, some, major}`

At completion it prints three JSON artifacts:

1. Fixed Regimen Range Response
2. Completed Questionnaire Response
3. Burden Analysis Result

## Full Spec Audit

Run a full comparison against the official fixture bundle in the spec folder:

```bash
npm run spec:audit
```

Run in strict mode (non-zero exit when any fixture is mismatched or unsupported):

```bash
npm run spec:audit:strict
```

## Usage

```javascript
const {
  showRegimenRange,
  runBurdenQuestionnaire,
  calculateBurdenRange
} = require('@dfu-hbot/bounded-regimen-and-execution-burden');

const regimen = showRegimenRange({ request_type: 'show_regimen_range' });

const questionnaireResponse = await runBurdenQuestionnaire(async (question) => {
  if (question.id === 'Q01') {
    return 'https://kgrid.org/cks/dfu-hbot-burden/providers/e-001';
  }
  if (question.id === 'Q02') {
    return 8.5;
  }
  if (question.id === 'Q03') {
    return 25;
  }
  if (question.id === 'Q04') {
    return 'some';
  }
  throw new Error('Unexpected question');
});

const analysis = calculateBurdenRange({
  request_type: 'calculate_burden_range',
  provider_roster_version_iri:
    'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0',
  questionnaire_response: questionnaireResponse,
  fixed_regimen_range_response: regimen
});

console.log(analysis);
```
