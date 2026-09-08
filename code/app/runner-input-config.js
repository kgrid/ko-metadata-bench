const responseOptions = [
  { value: "0", label: "No" },
  { value: "1", label: "Yes" },
  { value: "X", label: "Not asked" },
  { value: "i", label: "Incomplete" },
];

const yesNoOptions = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const wagnerQuestions = [
  ["q01", "Is extensive gangrene present involving most or all of the foot?"],
  ["q02", "Is localized gangrene present involving only part of the foot?"],
  ["q03", "Is a deep abscess present?"],
  ["q04", "Is osteomyelitis present?"],
  ["q05", "Is comparably deep infection present?"],
  ["q06", "Is an open ulcer present?"],
  ["q07", "Does the ulcer extend into a deep anatomical structure?"],
  ["q08", "Is the ulcer limited to skin or superficial subcutaneous tissue?"],
  ["q09", "Is the skin intact?"],
  ["q10", "Is this an at-risk or previously ulcerated site with intact skin?"],
];

const words = (value) => String(value ?? "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const list = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const display = (value) => {
  if (value == null || value === "") return "Not supplied";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(" – ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};
const row = (label, value) => ({ label, value: display(value) });
const errorsFrom = (output) => list(output?.errors ?? (output?.error ? output.error : [])).filter(Boolean).map((error) => typeof error === "object"
  ? { code: display(error.code ?? output?.result_id ?? "Error"), path: display(error.path ?? error.field ?? output?.error_field ?? "Not supplied"), message: display(error.message ?? output?.display_text ?? "The operation returned an error.") }
  : { code: "Error", path: "Not supplied", message: display(error) });
const warningItems = (warnings) => Array.isArray(warnings) ? warnings.map(display) : warnings && typeof warnings === "object"
  ? Object.entries(warnings).map(([key, value]) => `${words(key)}: ${display(value)}`) : warnings ? [display(warnings)] : [];

const configs = {
  "workshop-ko-1": {
    title: "Completed questionnaire response",
    exampleName: "Deep ulcer example",
    operationScope: "Runs Wagner response analysis.",
    fields: wagnerQuestions.map(([key, label], index) => ({
      key, label, type: "select", options: responseOptions,
      defaultValue: ["0", "0", "0", "0", "0", "1", "1", "X", "0", "0"][index],
    })),
    createInput(state) {
      return {
        specification_iri: "https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0",
        response_model_iri: "https://kgrid.org/cks/meggitt-wagner/response-models/1.0/CompletedQuestionnaireResponse",
        question_ids: wagnerQuestions.map((_, index) => `Q${String(index + 1).padStart(2, "0")}`),
        responses: wagnerQuestions.map(([key]) => state[key]),
      };
    },
    projectOutput(output) {
      const score = list(output?.wagner_score)[0], grade = list(output?.grade_label)[0];
      return {
        status: { label: words(output?.analysis_status ?? "Result returned"), tone: output?.analysis_status === "grade_computed" ? "success" : "attention" },
        conclusion: { label: "Wagner classification", value: grade ?? "No grade computed", detail: score == null ? "The response did not produce a single grade." : `Wagner score ${score}` },
        metrics: [row("Questions evaluated", output?.question_ids?.length ?? 0), row("Responses returned", output?.responses?.length ?? 0)],
        sections: [{ title: "Normalized response", rows: list(output?.question_ids).map((id, index) => row(id, output?.responses?.[index])) }],
        warnings: warningItems(output?.warnings), errors: errorsFrom(output),
      };
    },
  },
  "workshop-ko-2": {
    title: "Treatment decision inputs",
    exampleName: "Standard decision example",
    operationScope: "Runs the HBOT treatment-decision operation.",
    fields: [
      { key: "dfuConfirmed", label: "Diabetes-related foot ulcer confirmed", type: "segmented", options: yesNoOptions, defaultValue: "true" },
      { key: "wagnerGrade", label: "Wagner grade", type: "select", options: [0, 1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `Grade ${value}` })), defaultValue: "3" },
      { key: "acuteSurgery", label: "Acute surgical intervention", type: "segmented", options: yesNoOptions, defaultValue: "true" },
      { key: "notHealed", label: "Not healed after 30 days of standard care", type: "segmented", options: yesNoOptions, defaultValue: "false" },
    ],
    createInput(state) {
      return {
        dfu_confirmed: state.dfuConfirmed,
        wagner_grade: Number(state.wagnerGrade),
        acute_surgical_intervention: state.acuteSurgery,
        not_healed_after_30_days: state.notHealed,
      };
    },
    projectOutput(output) {
      const failed = output?.status === "error";
      return {
        status: { label: words(output?.status ?? "Result returned"), tone: failed ? "error" : output?.status === "completed" ? "success" : "attention" },
        conclusion: { label: "Treatment decision", value: output?.display_text ?? "No decision supplied", detail: output?.result_id ? `Result ${output.result_id}` : "" },
        metrics: [row("Evidence quality", words(output?.evidence_quality)), row("Recommendation strength", words(output?.recommendation_strength))],
        sections: [{ title: "Decision basis", rows: [row("Applied rule", output?.rule_id), row("Source", output?.source_reference)] }],
        warnings: warningItems(output?.warnings),
        errors: failed ? [{ code: display(output?.result_id), path: display(output?.error_field), message: display(output?.display_text) }] : errorsFrom(output),
      };
    },
  },
  "workshop-ko-3": {
    title: "Treatment burden inputs",
    exampleName: "Appendix E travel example",
    operationScope: "Runs burden-range calculation.",
    fields: [
      {
        key: "provider",
        label: "HBOT facility",
        type: "lookup",
        optionsSource: {
          file: "spec/DFU_HBOT_Provider_Roster_Snapshot_Version_1_0.json",
          collection: "records",
          value: "provider_iri",
          label: "facility_listing",
          detail: "normalized_address_candidate",
          identifier: "compact_id",
          filter: { key: "selectable", value: true },
        },
        defaultValue: "https://kgrid.org/cks/dfu-hbot-burden/providers/e-001",
      },
      { key: "miles", label: "One-way distance", type: "number", unit: "miles", min: 0, step: 0.1, defaultValue: 5 },
      { key: "minutes", label: "One-way travel time", type: "number", unit: "minutes", min: 0, step: 1, defaultValue: 15 },
      { key: "difficulty", label: "Weekday attendance difficulty", type: "select", options: [{ value: "none", label: "None" }, { value: "some", label: "Some" }, { value: "major", label: "Major" }], defaultValue: "none" },
    ],
    createInput(state) {
      const specification = "https://kgrid.org/cks/dfu-hbot-burden/versions/cks-1.0";
      const responseModel = "https://kgrid.org/cks/dfu-hbot-burden/response-models/1.0";
      const roster = "https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0";
      return {
        request_type: "calculate_burden_range",
        provider_roster_version_iri: roster,
        questionnaire_response: {
          specification_iri: specification, questionnaire_status: "completed", response_model_iri: responseModel,
          provider_roster_version_iri: roster,
          response_projection: {
            hyperbaric_oxygen_therapy_location: state.provider,
            one_way_miles: Number(state.miles),
            one_way_travel_minutes: Number(state.minutes),
            weekday_attendance_difficulty: state.difficulty,
          },
          confirmed: true,
        },
        fixed_regimen_range_response: {
          specification_iri: specification, response_type: "fixed_regimen_range_response", response_model_iri: responseModel,
          status: "completed", knowledge_package_iri: "https://kgrid.org/cks/dfu-hbot-burden/knowledge-packages/general-dfu-regimen/versions/1.0",
          knowledge_scope: "general_not_patient_specific", indication: "diabetes_related_foot_ulcer",
          shorter_regimen_scenario: { episodes: 30, sessions_per_week: 5, course_weeks: 6 },
          longer_regimen_scenario: { episodes: 40, sessions_per_week: 5, course_weeks: 8 },
          combined_range: { episodes: [30, 40], sessions_per_week: 5, course_weeks: [6, 8] },
          scheduled_facility_hours_per_episode: { value: 3, unit: "h" }, tailored_to_patient: false,
          display_label: "General DFU HBOT planning range: approximately 30–40 episodes, usually five per week, over approximately 6–8 weeks.",
        },
      };
    },
    projectOutput(output) {
      const burden = output?.objective_burden ?? {}, overall = burden?.overall_burden_range ?? {}, travel = burden?.reported_one_way_travel ?? {};
      const failed = output?.status !== "completed";
      return {
        status: { label: words(output?.status ?? "Result returned"), tone: failed ? "error" : "success" },
        conclusion: { label: "Execution burden", value: output?.execution_burden_level?.display_text ?? words(output?.result_code ?? "No burden result"), detail: output?.execution_burden_level?.primary_driver ?? "" },
        metrics: [row("Treatment episodes", overall.episodes), row("Total patient hours", overall.total_patient_hours), row("Course miles", overall.course_miles)],
        sections: [
          { title: "Normalized travel input", rows: [row("One-way distance", travel.miles == null ? null : `${travel.miles} miles`), row("One-way travel time", travel.minutes == null ? null : `${travel.minutes} minutes`), row("Attendance", output?.weekday_attendance_feasibility?.display_text)] },
          { title: "Supporting details", rows: [row("Facility", burden?.hyperbaric_oxygen_therapy_location_reference?.facility_listing), row("Jurisdiction", burden?.hyperbaric_oxygen_therapy_location_reference?.jurisdiction), row("Sensitivity", output?.sensitivity ? `${output.sensitivity.incremental_total_hours} additional hours across the longer regimen` : null)] },
        ],
        notes: list(output?.assumptions).map((item) => display(item?.text ?? item)), warnings: warningItems(output?.warnings), errors: errorsFrom(output),
      };
    },
  },
  "workshop-ko-4": {
    title: "Prognostic measurements",
    exampleName: "Larger, longer-duration wound",
    operationScope: "Runs DFU prognostic evaluation.",
    fields: [
      { key: "area", label: "Wound area", type: "number", unitKey: "areaUnit", min: 0.01, step: 0.1, defaultValue: 3 },
      { key: "areaUnit", label: "Area unit", type: "select", options: [{ value: "cm2", label: "Square centimetres (cm²)" }, { value: "mm2", label: "Square millimetres (mm²)" }], defaultValue: "cm2" },
      { key: "duration", label: "Wound duration", type: "number", unitKey: "durationUnit", min: 0, step: 0.1, defaultValue: 12 },
      { key: "durationUnit", label: "Duration unit", type: "select", options: [{ value: "wk", label: "Weeks" }, { value: "d", label: "Days" }], defaultValue: "wk" },
    ],
    createInput(state) {
      return {
        wound_area: { value: Number(state.area), ucum_code: state.areaUnit },
        wound_duration: { value: Number(state.duration), ucum_code: state.durationUnit },
      };
    },
    projectOutput(output) {
      const success = output?.status === "success", normalized = output?.normalized_inputs ?? {};
      const duration = normalized?.wound_duration, rational = duration?.exact_value;
      return {
        status: { label: words(output?.status ?? "Result returned"), tone: success ? "success" : "error" },
        conclusion: { label: "Estimated healing at 16 weeks", value: output?.display_probability_percent ?? "No estimate produced", detail: success ? words(output?.prognostic_group) : "The input could not be evaluated." },
        metrics: [row("Area category", output?.area_category), row("Duration category", output?.duration_category)],
        sections: [
          { title: "Normalized inputs", rows: [row("Wound area", normalized?.wound_area ? `${normalized.wound_area.value} ${normalized.wound_area.ucum_code}` : null), row("Wound duration", rational ? `${rational.numerator / rational.denominator} ${duration.ucum_code}` : null)] },
          { title: "Classification basis", rows: list(output?.basis).map((item) => row(words(item.input), `${item.comparison_value} ${item.ucum_code} ${item.operator} ${item.threshold}`)) },
        ],
        notes: list(output?.specification_notes).map(display), warnings: warningItems(output?.warnings), errors: errorsFrom(output),
      };
    },
  },
};

function materializeOptions(field, readText) {
  if (!field.optionsSource) return field;
  if (typeof readText !== "function") return { ...field, options: [] };
  try {
    const source = field.optionsSource;
    const parsed = JSON.parse(readText(source.file));
    const records = Array.isArray(parsed?.[source.collection]) ? parsed[source.collection] : [];
    const filtered = source.filter
      ? records.filter((record) => record?.[source.filter.key] === source.filter.value)
      : records;
    const options = filtered.flatMap((record) => {
      const value = record?.[source.value];
      const primary = record?.[source.label];
      if (typeof value !== "string" || typeof primary !== "string" || !value || !primary) return [];
      const detail = typeof record?.[source.detail] === "string" ? record[source.detail] : "";
      const identifier = typeof record?.[source.identifier] === "string" ? record[source.identifier] : "";
      const label = [primary, detail, identifier].filter(Boolean).join(" · ");
      return [{ value, label, primary, detail, identifier }];
    });
    return { ...field, options };
  } catch {
    return { ...field, options: [] };
  }
}

export function runnerInputConfig(knowledgeObjectId, readText) {
  const config = configs[knowledgeObjectId] ?? null;
  if (!config) return null;
  return { ...config, fields: config.fields.map((field) => materializeOptions(field, readText)) };
}

export function runnerExampleState(config) {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.defaultValue]));
}

export function createRunnerInput(config, state) {
  return config.createInput(state);
}

export function projectRunnerOutput(config, output) {
  if (!config || !output || typeof output !== "object" || Array.isArray(output)) {
    return {
      status: { label: "Malformed result", tone: "error" },
      conclusion: { label: "Result", value: "The Runner did not return a structured result.", detail: "Inspect Source for the exact value." },
      metrics: [], sections: [], warnings: [], errors: [],
    };
  }
  return config.projectOutput(output);
}
