import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRunnerInput, projectRunnerOutput, runnerExampleState, runnerInputConfig } from "../app/runner-input-config.js";

test("every embedded KO has a human-readable Runner input configuration", () => {
  for (const id of ["workshop-ko-1", "workshop-ko-2", "workshop-ko-3", "workshop-ko-4"]) {
    const config = runnerInputConfig(id);
    assert.ok(config);
    assert.ok(config.title);
    assert.ok(config.exampleName);
    assert.match(config.operationScope, /^Runs .+\.$/);
    assert.ok(config.fields.length > 0);
    for (const field of config.fields) {
      assert.ok(field.label);
      assert.ok(["select", "segmented", "number", "lookup"].includes(field.type));
    }
  }
});

test("the HBOT burden form derives every selectable facility from its embedded roster", () => {
  const rosterPath = new URL("../runner-ready-kos/HBOT regimen burden KO/spec/DFU_HBOT_Provider_Roster_Snapshot_Version_1_0.json", import.meta.url);
  const config = runnerInputConfig("workshop-ko-3", (file) => {
    assert.equal(file, "spec/DFU_HBOT_Provider_Roster_Snapshot_Version_1_0.json");
    return readFileSync(rosterPath, "utf8");
  });
  const provider = config.fields.find((field) => field.key === "provider");
  assert.equal(provider.type, "lookup");
  assert.equal(provider.options.length, 141);
  assert.equal(provider.options[0].value, "https://kgrid.org/cks/dfu-hbot-burden/providers/e-001");
  assert.match(provider.options[0].label, /Center for Wound Care & Hyperbaric Medicine/);
  assert.match(provider.options[0].label, /Mobile, Alabama/);
  assert.match(provider.options[0].label, /E-001/);
});

test("each Runner configuration identifies only the particular operation it exposes", () => {
  assert.deepEqual([1, 2, 3, 4].map((number) => runnerInputConfig(`workshop-ko-${number}`).operationScope), [
    "Runs Wagner response analysis.",
    "Runs the HBOT treatment-decision operation.",
    "Runs burden-range calculation.",
    "Runs DFU prognostic evaluation.",
  ]);
});

test("supplied examples deterministically produce each KO's native input shape", () => {
  const inputs = Object.fromEntries([1, 2, 3, 4].map((number) => {
    const config = runnerInputConfig(`workshop-ko-${number}`);
    return [number, createRunnerInput(config, runnerExampleState(config))];
  }));
  assert.deepEqual(inputs[1].question_ids, ["Q01", "Q02", "Q03", "Q04", "Q05", "Q06", "Q07", "Q08", "Q09", "Q10"]);
  assert.equal(inputs[1].responses.length, 10);
  assert.equal(inputs[2].wagner_grade, 3);
  assert.equal(inputs[3].questionnaire_response.response_projection.one_way_miles, 5);
  assert.deepEqual(inputs[4], { wound_area: { value: 3, ucum_code: "cm2" }, wound_duration: { value: 12, ucum_code: "wk" } });
});

test("form state is independent for each use", () => {
  const config = runnerInputConfig("workshop-ko-4");
  const first = runnerExampleState(config);
  first.area = 99;
  assert.equal(runnerExampleState(config).area, 3);
});

test("every configured Runner produces a concise human-readable output model", () => {
  const fixtures = {
    1: { analysis_status: "grade_computed", question_ids: ["Q01"], responses: ["1"], wagner_score: [2], grade_label: ["Deep ulcer"] },
    2: { status: "completed", result_id: "OUTPUT-02", display_text: "Suggest adding HBO₂ urgently after surgery.", evidence_quality: "moderate", recommendation_strength: "conditional", rule_id: "ALG-03" },
    3: { status: "completed", execution_burden_level: { display_text: "Low execution burden", primary_driver: "Repeated attendance" }, objective_burden: { overall_burden_range: { episodes: [30, 40] } } },
    4: { status: "success", display_probability_percent: "20.3%", prognostic_group: "AREA_GE_2__DURATION_GE_8", area_category: "AREA-GE-2", duration_category: "DUR-GE-8" },
  };
  const conclusions = ["Deep ulcer", "Suggest adding HBO₂ urgently after surgery.", "Low execution burden", "20.3%"];
  for (const number of [1, 2, 3, 4]) {
    const model = projectRunnerOutput(runnerInputConfig(`workshop-ko-${number}`), fixtures[number]);
    assert.equal(model.conclusion.value, conclusions[number - 1]);
    assert.ok(model.status.label);
  }
});

test("a structured knowledge-object error remains a projected result", () => {
  const model = projectRunnerOutput(runnerInputConfig("workshop-ko-2"), { status: "error", result_id: "INVALID_INPUT", error_field: "wagner_grade", display_text: "Wagner grade is required." });
  assert.equal(model.status.tone, "error");
  assert.deepEqual(model.errors[0], { code: "INVALID_INPUT", path: "wagner_grade", message: "Wagner grade is required." });
});

test("a malformed Runner return has a safe projection while Source can retain its exact value", () => {
  const model = projectRunnerOutput(runnerInputConfig("workshop-ko-1"), "not structured");
  assert.equal(model.status.label, "Malformed result");
  assert.match(model.conclusion.value, /structured result/);
});
