# Wagner Classification 

Adaptive Yes/No questionnaire logic for Section 3 of the Wagner Classification questionnaire.

## Install

```bash
npm install @wagner/classification
```

## Exports

- Questionnaire module (`@wagner/classification`):
  - `QUESTIONS`: ordered list of questions (`Q01` to `Q10`)
  - `TERM_DEFINITIONS`: Appendix A working definitions keyed by term
  - `runQuestionnaire(askYesNo)`: adaptive engine
  - Optional equivalent subpath import: `@wagner/classification/questionnaire`
- Scorer module (`@wagner/classification/scorer`):
  - `analyzeQuestionnaireResponse(payload)`: independent response-analysis scorer
  - `ANALYSIS_STATUS`: Section 6 analysis statuses
  - `GRADE_LABEL_BY_SCORE`: score-to-label mapping
- Knowledge Object boundary (`@wagner/classification/knowledge-object`):
  - `run(input)`: asynchronous published interface that delegates to the scorer

## Usage

```js
const {
  QUESTIONS,
  runQuestionnaire
} = require('@wagner/classification');
// Optional equivalent:
// const { QUESTIONS, runQuestionnaire } = require('@wagner/classification/questionnaire');
const {
  analyzeQuestionnaireResponse
} = require('@wagner/classification/scorer');

async function askYesNo(question) {
  // Replace with your UI/CLI collection logic.
  // Must return true (Yes) or false (No).
  // `question.definitions` is a dictionary of related Appendix A terms:
  // {
  //   "open ulcer": { definition, term_iri },
  //   "intact skin": { definition, term_iri }
  // }
  console.log(`${question.id}: ${question.text}`);
  return Math.random() > 0.5;
}

(async () => {
  const outcome = await runQuestionnaire(askYesNo);

  console.log(JSON.stringify(outcome, null, 2));
  // Shape:
  // {
  //   specification_iri,
  //   response_model_iri,
  //   question_set_iri,
  //   question_ids,
  //   responses,
  //   directly_answered_questions,
  //   entailed_questions
  // }

  const analysis = analyzeQuestionnaireResponse(outcome);
  console.log(JSON.stringify(analysis, null, 2));
  // {
  //   question_ids,
  //   responses,
  //   analysis_status,
  //   wagner_score,
  //   grade_label
  // }
})();
```

The published Knowledge Object boundary may be used directly:

```js
const knowledgeObject = require('@wagner/classification/knowledge-object');
const analysis = await knowledgeObject.run(completedResponse);
```

## CLI

Run directly from your project:

```bash
npx wagner
```

Or after global install:

```bash
npm install -g @wagner/classification
wagner
```

CLI accepts `y/yes` and `n/no` for each prompted question.
It prints two JSON artifacts at completion:
- the Completed Questionnaire Response payload
- the full Questionnaire Response Analysis result from `analyzeQuestionnaireResponse`

For readability, CLI JSON keeps object structure indented while rendering arrays on one line.

## Behavior guarantees

- Only required questions are asked according to the branching logic.
- Entailed values are auto-populated.
- Non-applicable questions are marked as `"X"`.
- Contradictory state transitions throw errors.
- `directly_answered_questions` and `entailed_questions` are emitted in canonical `Q01`-through-`Q10` order.
- Response-analysis control symbols are case-sensitive: accepted values are `"X"` (never asked) and `"i"` (incomplete).

## Notebooks

Try this package here:

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/kgrid-objects/FAIR-DO-Workshop/HEAD?urlpath=lab/tree/collection/wagner/wagner_binder.ipynb%3Fkernel_name%3Djavascript)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/kgrid-objects/FAIR-DO-Workshop/blob/HEAD/collection/wagner/wagner_colab.ipynb)
[![Open In Scribbler](https://img.shields.io/badge/Open%20In-Scribbler-2F9E44?logo=javascript&logoColor=white)](https://app.scribbler.live/?jsnb=https://raw.githubusercontent.com/kgrid-objects/FAIR-DO-Workshop/HEAD/collection/wagner/wagner_scribbler.jsnb)
