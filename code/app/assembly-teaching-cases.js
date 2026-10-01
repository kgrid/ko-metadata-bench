export const ASSEMBLY_CASE_IDS = Object.freeze(["case-1", "case-2", "case-3", "case-4", "case-5"]);

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

export function loadAssemblyTeachingCases(assembly) {
  if (!isRecord(assembly) || !isRecord(assembly.textFiles)) {
    return { cases: [], error: "Teaching cases are unavailable in this assembly." };
  }
  const cases = [];
  for (const id of ASSEMBLY_CASE_IDS) {
    const label = `Case ${id.slice(5)}`;
    const source = assembly.textFiles[`auxiliary/aux-teaching/cases/${id}.json`];
    if (typeof source !== "string") return { cases: [], error: `${label} is missing from the embedded assembly.` };
    let record;
    try { record = JSON.parse(source); }
    catch { return { cases: [], error: `${label} cannot be read because its case file is malformed.` }; }
    const request = record?.request;
    const trace = record?.semantic_trace;
    const outputs = trace?.ko_outputs;
    const decisions = trace?.ka_decisions;
    const valid = record?.id === id && nonempty(record.title)
      && isRecord(request) && nonempty(request.request_id) && isRecord(request.subject_binding)
      && isRecord(request.hbot_case_assertions) && isRecord(request.margolis_first_visit_assessment)
      && isRecord(request.wagner_response_artifact) && isRecord(request.burden_questionnaire_artifact)
      && nonempty(request.subject_binding.subject_identifier?.value)
      && nonempty(request.subject_binding.ulcer_identifier?.value)
      && typeof request.hbot_case_assertions.dfu_confirmed?.value === "boolean"
      && typeof request.margolis_first_visit_assessment.wound_area?.value === "number"
      && typeof request.margolis_first_visit_assessment.wound_duration?.value === "number"
      && typeof request.burden_questionnaire_artifact.one_way_travel_minutes === "number"
      && Array.isArray(request.wagner_response_artifact.question_ids)
      && Array.isArray(request.wagner_response_artifact.responses)
      && request.wagner_response_artifact.question_ids.length === request.wagner_response_artifact.responses.length
      && ["Q06", "Q10"].every((key) => request.wagner_response_artifact.question_ids.includes(key))
      && isRecord(trace) && trace.trace_version === 1 && isRecord(outputs)
      && ["wagner", "hbot_decision", "burden", "margolis"].every((key) =>
        isRecord(outputs[key]) && nonempty(outputs[key].produced_by) && isRecord(outputs[key].native_output))
      && Array.isArray(trace.handoffs) && trace.handoffs.every(isRecord)
      && isRecord(decisions) && isRecord(decisions.mandatory_join)
      && Array.isArray(decisions.mandatory_join.dependency_states)
      && isRecord(decisions.gate) && nonempty(decisions.gate.result)
      && (decisions.synthesis === null || (isRecord(decisions.synthesis)
        && nonempty(decisions.synthesis.rule_id)
        && Array.isArray(decisions.synthesis.ordered_bands)
        && decisions.synthesis.ordered_bands.length === 2))
      && isRecord(decisions.final) && nonempty(decisions.final.target_classification);
    if (!valid) return { cases: [], error: `${label} is incomplete or malformed in the embedded assembly.` };
    // The expected result is a test oracle, never part of the learner-facing record.
    cases.push({ id, title: record.title, request, semanticTrace: trace });
  }
  return { cases, error: null };
}

export function projectAssemblyCaseInputs(request) {
  const binding = request.subject_binding;
  const assessment = request.margolis_first_visit_assessment;
  const burden = request.burden_questionnaire_artifact;
  const answers = request.wagner_response_artifact;
  const responseFor = (id) => answers.responses[answers.question_ids.indexOf(id)];
  const siteFinding = responseFor("Q06") === "1" ? "Open ulcer indicated"
    : responseFor("Q10") === "1" ? "At-risk, intact site indicated"
    : "Assessment responses supplied";
  return {
    subject: binding.subject_identifier.value,
    ulcer: binding.ulcer_identifier.value,
    facts: [
      { label: "Site finding", value: siteFinding },
      { label: "Diabetic foot ulcer", value: request.hbot_case_assertions.dfu_confirmed.value ? "Confirmed" : "Not confirmed" },
      { label: "First-visit wound area", value: `${assessment.wound_area.value} cm²` },
      { label: "First-visit wound duration", value: `${assessment.wound_duration.value} weeks` },
      { label: "One-way travel to facility", value: `${burden.one_way_travel_minutes} minutes` },
    ],
  };
}

export function projectAssemblyKoContributions(trace) {
  const outputs = trace.ko_outputs;
  const handoffTo = (destination) => trace.handoffs.find((handoff) => handoff.to === destination);
  const hasSynthesisHandoff = (source) => trace.handoffs.some((handoff) =>
    handoff.from === source && handoff.to === "KA synthesis band");
  const wagner = outputs.wagner.native_output;
  const decision = outputs.hbot_decision.native_output;
  const margolis = outputs.margolis.native_output;
  const burden = outputs.burden.native_output;
  const grade = wagner.grade_label?.[0] ?? "Assessment completed";
  const score = wagner.wagner_score?.[0];
  const decisionInput = handoffTo("DEP-HBOT-DECISION");
  return {
    wagner: {
      entry: handoffTo("DEP-WAGNER") ? "Assessment answers → Wagner" : null,
      result: Number.isFinite(score) ? `Wagner grade ${score}` : "Wagner assessment",
      detail: grade,
    },
    decision: {
      entry: decisionInput ? `Wagner grade ${decisionInput.value?.wagner_grade ?? score} and clinical assertions → HBOT Decision` : null,
      result: decision.display_text ?? "Decision recorded",
      detail: decision.status === "out-of-scope" ? "Outside this KO’s clinical scope" : "Decision completed",
      exit: handoffTo("KA gate") ? "HBOT Decision result → KA gate" : null,
    },
    margolis: {
      entry: handoffTo("DEP-MARGOLIS") ? "First-visit wound area and duration → Margolis" : null,
      result: margolis.display_probability_percent ? `${margolis.display_probability_percent} estimated healing at 16 weeks` : "Prognostic result recorded",
      detail: "Independent prognostic contribution",
      exit: hasSynthesisHandoff("DEP-MARGOLIS.native_output") ? "Margolis result → KA synthesis" : null,
    },
    burden: {
      entry: handoffTo("DEP-BURDEN") ? "Travel answers and regimen → Burden" : null,
      result: burden.execution_burden_level?.display_text ?? "Burden result recorded",
      detail: burden.execution_burden_level?.primary_driver ?? "Independent burden contribution",
      exit: hasSynthesisHandoff("DEP-BURDEN.native_output") ? "Burden result → KA synthesis" : null,
    },
  };
}

// A shared exchange contract: each KO can supply readable sections alongside its exact records.
// Only Wagner has a learner-facing projection today; other roles can be added without changing the viewer.
export function projectAssemblyKoExchange(caseRecord, role) {
  if (!caseRecord?.request || !caseRecord?.semanticTrace) return null;
  if (role !== "wagner") {
    const dependencies = { decision: "DEP-HBOT-DECISION", margolis: "DEP-MARGOLIS", burden: "DEP-BURDEN" };
    const outputKeys = { decision: "hbot_decision", margolis: "margolis", burden: "burden" };
    const dependency = dependencies[role];
    if (!dependency) return null;
    const handoffs = caseRecord.semanticTrace.handoffs;
    const incoming = handoffs.find((item) => item.to === dependency);
    const outgoing = handoffs.find((item) => String(item.from).startsWith(`${dependency}.`));
    const output = caseRecord.semanticTrace.ko_outputs?.[outputKeys[role]]?.native_output;
    if (!isRecord(incoming?.value) || !isRecord(output)) return null;
    const input = incoming.value;
    const yesNo = (value) => value === "true" || value === true ? "Yes" : value === "false" || value === false ? "No" : String(value ?? "Not recorded");
    const range = (value) => Array.isArray(value) ? value.join("–") : String(value ?? "Not recorded");
    const stopped = "Not passed to synthesis; the HBOT use gate ended this path.";
    if (role === "decision") return { role,
      input: { summary: "The KA combines the Wagner grade with clinical assertions for the HBOT decision.", sections: [{ heading: "Decision inputs", items: [
        { label: "Wagner grade", value: String(input.wagner_grade ?? "Not recorded") },
        { label: "Diabetic foot ulcer confirmed", value: yesNo(input.dfu_confirmed) },
        { label: "Acute surgical intervention", value: yesNo(input.acute_surgical_intervention) },
        { label: "Not healed after 30 days", value: yesNo(input.not_healed_after_30_days) },
      ] }], source: input },
      output: { summary: output.display_text ?? "Decision result recorded.", sections: [{ heading: "Decision result", items: [
        { label: "Status", value: output.status ?? "Not recorded" },
        { label: "Result", value: output.result_id ?? "Not recorded" },
        { label: "Evidence quality", value: output.evidence_quality ?? "Not declared" },
        { label: "Recommendation strength", value: output.recommendation_strength ?? "Not declared" },
      ] }], source: output },
      handoff: { summary: "The KA supplies the Wagner grade and clinical assertions, then uses this KO's result at the HBOT gate.", sections: [{ heading: "Recorded handoffs", items: [
        { label: "Into HBOT Decision", value: `Wagner grade ${input.wagner_grade} with clinical assertions` },
        { label: "To HBOT use gate", value: String(outgoing?.value ?? "No result handed off") },
      ] }], source: [incoming, outgoing].filter(Boolean) },
    };
    if (role === "margolis") return { role,
      input: { summary: "The KA supplies first-visit wound measurements for the prognostic calculation.", sections: [{ heading: "First-visit measurements", items: [
        { label: "Wound area", value: `${input.wound_area?.value ?? "Not recorded"} ${input.wound_area?.ucum_code ?? ""}`.trim() },
        { label: "Wound duration", value: `${input.wound_duration?.value ?? "Not recorded"} ${input.wound_duration?.ucum_code ?? ""}`.trim() },
      ] }], source: input },
      output: { summary: `${output.display_probability_percent ?? "Unknown"} estimated 16-week healing probability.`, sections: [{ heading: "Prognostic result", items: [
        { label: "Prognostic group", value: output.prognostic_group ?? "Not recorded" },
        { label: "16-week healing probability", value: output.display_probability_percent ?? "Not recorded" },
        { label: "Result", value: output.result_id ?? "Not recorded" },
      ] }], source: output },
      handoff: { summary: outgoing ? "The KA projects the KO's prognostic group into a synthesis band." : stopped, sections: [{ heading: "Recorded handoffs", items: [
        { label: "Into prognostic KO", value: "First-visit wound area and duration" },
        { label: "To assembly synthesis", value: outgoing ? `${outgoing.native_value} → ${outgoing.projected_value}` : stopped },
      ] }], source: [incoming, outgoing].filter(Boolean) },
    };
    const questionnaire = input.questionnaire_response ?? {};
    const regimen = input.fixed_regimen_range ?? {};
    const level = output.execution_burden_level ?? {};
    return { role,
      input: { summary: "The KA supplies the completed burden questionnaire and a fixed planning regimen range.", sections: [{ heading: "Burden inputs", items: [
        { label: "HBOT facility", value: String(questionnaire.hyperbaric_oxygen_therapy_location ?? "Not recorded").split("/").at(-1) },
        { label: "One-way travel", value: `${questionnaire.one_way_miles ?? "?"} miles · ${questionnaire.one_way_travel_minutes ?? "?"} minutes` },
        { label: "Weekday attendance difficulty", value: questionnaire.weekday_attendance_difficulty ?? "Not recorded" },
        { label: "Regimen", value: `${range(regimen.episodes)} episodes · ${regimen.sessions_per_week ?? "?"}/week · ${range(regimen.course_weeks)} weeks` },
      ] }], source: input },
      output: { summary: level.display_text ?? "Burden result recorded.", sections: [{ heading: "Computed burden", items: [
        { label: "Burden level", value: level.display_text ?? "Not recorded" },
        { label: "Primary driver", value: level.primary_driver ?? "Not recorded" },
        { label: "Total patient time", value: `${range(output.objective_burden?.overall_burden_range?.total_patient_hours)} hours` },
        { label: "Result", value: output.result_code ?? "Not recorded" },
      ] }], source: output },
      handoff: { summary: outgoing ? "The KA projects the KO's execution burden into a synthesis band." : stopped, sections: [{ heading: "Recorded handoffs", items: [
        { label: "Into burden KO", value: "Questionnaire responses and fixed regimen range" },
        { label: "To assembly synthesis", value: outgoing ? `${outgoing.native_value} → ${outgoing.projected_value}` : stopped },
      ] }], source: [incoming, outgoing].filter(Boolean) },
    };
  }
  const input = caseRecord.request.wagner_response_artifact;
  const output = caseRecord.semanticTrace.ko_outputs?.wagner?.native_output;
  if (!isRecord(input) || !isRecord(output)) return null;
  const handoffs = caseRecord.semanticTrace.handoffs.filter((item) =>
    item.to === "DEP-WAGNER" || item.to === "DEP-HBOT-DECISION" && String(item.from).includes("DEP-WAGNER"));
  const responseMeaning = { "0": "Absent", "1": "Present", X: "Not asked" };
  const questions = input.question_ids.map((id, index) => ({
    label: id,
    value: `${input.responses[index]} — ${responseMeaning[input.responses[index]] ?? "Recorded response"}`,
  }));
  const score = output.wagner_score?.[0];
  return {
    role,
    input: {
      summary: "Completed questionnaire response supplied to the DFU Severity Score KO. X means not asked by the adaptive questionnaire.",
      sections: [
        { heading: "Questionnaire responses", items: questions },
        { heading: "Assessment record", items: [
          { label: "Subject", value: input.subject_identifier?.value ?? "Not recorded" },
          { label: "Ulcer / site", value: input.ulcer_identifier?.value ?? "Not recorded" },
          { label: "Completed", value: input.completed_at ?? "Not recorded" },
        ] },
      ],
      source: input,
    },
    output: {
      summary: Number.isFinite(score) ? `Wagner grade ${score}: ${output.grade_label?.[0] ?? "Grade computed"}` : "Assessment result recorded.",
      sections: [{ heading: "Computed result", items: [
        { label: "Status", value: output.analysis_status ?? "Not recorded" },
        { label: "Wagner score", value: Number.isFinite(score) ? String(score) : "Not recorded" },
        { label: "Grade description", value: output.grade_label?.[0] ?? "Not recorded" },
      ] }],
      source: output,
    },
    handoff: {
      summary: "The KA supplied the questionnaire response to Wagner, then passed the resulting grade to HBOT Treatment Decision.",
      sections: [{ heading: "Recorded handoffs", items: handoffs.map((item) => ({
        label: item.to === "DEP-WAGNER" ? "Into Wagner" : "Into HBOT Decision",
        value: item.to === "DEP-WAGNER"
          ? "Completed questionnaire responses"
          : `Wagner grade ${item.value?.wagner_grade ?? score} with clinical assertions`,
      })) }],
      source: handoffs,
    },
  };
}

export function projectAssemblyKaDecisions(trace) {
  const decisions = trace.ka_decisions;
  const states = decisions.mandatory_join.dependency_states;
  const completed = states.filter((item) => item.state === "completed_valid").length;
  const gateNames = {
    SUPPORTED: "Supported",
    NOT_SUPPORTED: "Not supported",
    OUT_OF_SCOPE: "Outside clinical scope",
    INSUFFICIENT_DECISION: "Insufficient decision",
  };
  const readable = (value) => value.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  const bandName = (value) => readable(value.replace(/_BAND$/, ""));
  const synthesis = decisions.synthesis;
  return {
    join: {
      result: decisions.mandatory_join.outcome === "pass" ? "Four-KO join passed" : "Four-KO join did not pass",
      detail: `${completed} of ${states.length} KO outputs completed and valid`,
    },
    gate: {
      result: gateNames[decisions.gate.result] ?? readable(decisions.gate.result),
      detail: `HBOT Decision result ${decisions.gate.native_result_id} mapped by ${decisions.gate.rule_id}`,
    },
    bands: synthesis ? [
      { source: "Margolis", result: bandName(synthesis.ordered_bands[0]) },
      { source: "Burden", result: bandName(synthesis.ordered_bands[1]) },
    ] : null,
    synthesis: synthesis ? {
      result: `Rule ${synthesis.rule_id}`,
      detail: "The two projected bands select one declared synthesis cell.",
    } : null,
    stop: synthesis ? null : "The HBOT gate ends this path. No band projection or synthesis rule is applied.",
    final: {
      result: readable(decisions.final.target_classification),
      detail: decisions.final.reason_code,
    },
  };
}

// Read the declared twelve-cell matrix as data; never execute embedded KA code.
export function projectAssemblySynthesisMatrix(assembly, trace) {
  const source = assembly?.textFiles?.["src/synthesis.js"];
  const block = typeof source === "string" ? source.match(/const MATRIX = \{([\s\S]*?)\n\};/)?.[1] : null;
  if (!block) return { cells: [], selectedRule: null, error: "The assembly synthesis matrix is unavailable." };
  const cells = [...block.matchAll(/'([A-Z_]+_PROGNOSIS_BAND)\|([A-Z_]+_BURDEN_BAND)': \['(SYN-[A-Z-]+-\d+)', '(ON_TARGET|NEAR_TARGET|OUTER_TARGET)'\]/g)]
    .map(([, prognosis, burden, rule, classification]) => ({ prognosis, burden, rule, classification }));
  if (cells.length !== 12 || new Set(cells.map((cell) => cell.rule)).size !== 12)
    return { cells: [], selectedRule: null, error: "The assembly synthesis matrix is incomplete." };
  const selectedRule = trace.ka_decisions.synthesis?.rule_id ?? null;
  if (selectedRule && !cells.some((cell) => cell.rule === selectedRule))
    return { cells: [], selectedRule: null, error: "This case's synthesis rule is absent from the assembly matrix." };
  return { cells, selectedRule, error: null };
}
