import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("React five-stage interface uses profile shapes, exact rail dies, and a transformation press", async () => {
  const page = await read("app/page.tsx");
  assert.doesNotMatch(page, /function ProfileFixture/);
  assert.match(page, /function ProfileTransformation/);
  assert.match(page, /className="profileTransformation interfaceStageGraphic" viewBox="35 3 90 70"/);
  assert.match(page, /function RailBindingDie/);
  assert.match(page, /RailBindingDie profile=\{inputObject\.profile\} direction="input"/);
  assert.match(page, /<ProfileTransformation inputProfile=\{inputObject\.profile\} outputProfile=\{outputObject\.profile\}/);
  assert.match(page, /RailBindingDie profile=\{outputObject\.profile\} direction="output"/);
  assert.match(page, /className="railDieCavity" d=\{shape\.path\}/);
  assert.doesNotMatch(page, /<ProfileFixture/);
});

test("standalone five-stage interface uses the same generic shape-fitting projection", async () => {
  const html = await read("outputs/Knowledge-Object-Workbench.html");
  assert.doesNotMatch(html, /function profileFixtureMarkupStandalone/);
  assert.match(html, /function profileTransformationMarkupStandalone/);
  assert.match(html, /class="profile-transformation interface-stage-graphic" viewBox="35 3 90 70"/);
  assert.match(html, /function profileRailDieMarkupStandalone/);
  assert.match(html, /profileRailDieMarkupStandalone\(inputProfile,"input"\)/);
  assert.match(html, /profileTransformationMarkupStandalone\(inputProfile,outputProfile\)/);
  assert.match(html, /profileRailDieMarkupStandalone\(outputProfile,"output"\)/);
  assert.doesNotMatch(html, /profileFixtureMarkupStandalone\(/);
});

test("both editions style all five diagrams as a coherent process row", async () => {
  const [styles, html] = await Promise.all([read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  for (const token of ["railBindingDie", "railDieCavity", "profileTransformation", "transformationPress"]) assert.match(styles, new RegExp(token));
  for (const token of ["rail-binding-die", "rail-die-cavity", "profile-transformation", "transformation-press"]) assert.match(html, new RegExp(token));
});

test("outcomes remain case controls and projections rather than a process panel or outcome rail", async () => {
  const [page, styles, html] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(page, /className="state3CaseSelector"/);
  assert.match(page, /showCaseDetail && simulationCase/);
  assert.doesNotMatch(page, /interfaceOutcomeRail|Outcome rail/);
  assert.doesNotMatch(styles, /outcomeRail|interfaceOutcomeRail/);
  assert.doesNotMatch(html, /interface-outcome-rail|outcome-rail|syncStandaloneOutcomeRail|Outcome rail/);
});

test("interface animation carries and transforms the generated profile contour", async () => {
  const [page, styles, html] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(page, /function InterfaceProcessToken/);
  assert.match(page, /className="tokenInput"/);
  assert.match(page, /className="tokenOutput"/);
  assert.doesNotMatch(page, /interfaceMotionRail[^\n]+<b/);
  assert.match(styles, /\.interfaceProcessToken\.transforming/);
  assert.match(styles, /@keyframes interfaceObjectReject/);
  assert.match(html, /function profileProcessTokenMarkupStandalone/);
  assert.match(html, /interface-process-token visible/);
  assert.match(html, /standalone-token-reject/);
});

test("both editions use one explicit continuous motion path instead of card-center arithmetic", async () => {
  const [page, styles, html] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(page, /const station = interfaceMotionFrame\(motionPhase, step\)/);
  assert.match(page, /data-motion-station=\{station\.stage\}/);
  assert.match(page, /<span className="interfaceMotionPath"/);
  assert.doesNotMatch(page, /\(\(Math\.max\(1, step\) - \.5\) \/ 5\)/);
  assert.match(styles, /\.interfaceMotionPath/);
  assert.match(styles, /cubic-bezier\(\.4,0,\.2,1\)/);
  assert.doesNotMatch(styles, /\.interfaceProcessToken\.docked/);
  assert.match(html, /standaloneInterfaceMotionStations=Object\.freeze/);
  assert.match(html, /standaloneInterfaceMotionStation\(step\)/);
  assert.match(html, /interface-process-token visible/);
  assert.doesNotMatch(html, /\(\(step-\.5\)\/5\*100\)/);
  assert.doesNotMatch(html, /interface-process-token\.docked/);
});

test("both editions expose deliberate binding-fit phases", async () => {
  const [page, motion, styles, html] = await Promise.all([read("app/page.tsx"), read("app/interface-motion.js"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  for (const phase of ["input-approach", "input-align", "input-snap", "input-seated", "output-approach", "output-snap-in", "output-seated", "output-release", "output-snap-out"]) {
    assert.match(motion, new RegExp(phase));
    assert.match(html, new RegExp(phase));
  }
  assert.match(page, /interfaceFitPlan\(plan\.failurePoint\)/);
  assert.match(page, /data-motion-phase=\{motionPhase\}/);
  assert.match(styles, /\.interfaceProcessToken\.fit-seated/);
  assert.match(html, /standaloneExplicitFitPlan/);
});

test("both editions render input snap as one mechanical catch with reduced-motion fallback", async () => {
  const [styles, html] = await Promise.all([read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(styles, /\[data-motion-phase="input-snap"\] \.interfaceProcessToken \{ animation: interfaceInputSnap/);
  assert.match(styles, /@keyframes interfaceInputSnap/);
  assert.match(styles, /@keyframes interfaceInputSocketCatch/);
  assert.match(styles, /@keyframes interfaceInputFixtureCouple/);
  assert.match(styles, /input-snap[\s\S]+fixtureAssembly \{ animation: interfaceInputFixtureCouple \.28s/);
  assert.match(styles, /translate\(calc\(-50% \+ 3px\),-50%\) scale\(1\.22\)/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]+input-snap[\s\S]+fixtureSocket \{ animation: none!important/);
  assert.doesNotMatch(styles, /\[data-motion-phase="output-snap-in"\] \.interfaceProcessToken \{ animation: interfaceInputSnap/);
  assert.match(html, /phaseTwoInputSnapStyle/);
  assert.match(html, /@keyframes standalone-input-snap/);
  assert.match(html, /@keyframes standalone-input-socket-catch/);
  assert.match(html, /@keyframes standalone-input-fixture-couple/);
  assert.match(html, /translate\(calc\(-50% \+ 3px\),-50%\) scale\(1\.22\)/);
  assert.match(html, /prefers-reduced-motion:reduce[\s\S]+input-snap[\s\S]+fixture-socket\{animation:none!important/);
  assert.doesNotMatch(html, /\[data-motion-phase="output-snap-in"\] \.interface-process-token\{animation:standalone-input-snap/);
});

test("both editions seat one persistent object inside an exact matching die", async () => {
  const [page, styles, html] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(page, /function RailBindingDie/);
  assert.match(page, /className="railDieCavity" d=\{shape\.path\}/);
  assert.match(page, /className="railDieLip" d=\{shape\.path\}/);
  assert.match(page, /RailBindingDie profile=\{inputObject\.profile\} direction="input"/);
  assert.match(page, /RailBindingDie profile=\{outputObject\.profile\} direction="output"/);
  assert.match(styles, /\.profileFixture \.fixtureWorkpieceCarrier \{ display: none; \}/);
  assert.match(styles, /input-locked[\s\S]+interfaceProcessToken[\s\S]+opacity: 1/);
  assert.match(styles, /output-locked[\s\S]+interfaceProcessToken[\s\S]+opacity: 1/);
  for (const behavior of ["interfaceDieSeat", "interfaceDieRelease", "interfaceDieTopOpen", "interfaceDieBottomOpen"]) assert.match(styles, new RegExp(`@keyframes ${behavior}`));
  assert.match(styles, /translate\(-50%,-92%\) scale\(\.92\)/);
  assert.match(styles, /translate\(-50%,-50%\) scale\(\.92\)/);
  assert.match(html, /function profileRailDieMarkupStandalone/);
  assert.match(html, /profileRailDieMarkupStandalone\(inputProfile,"input"\)/);
  assert.match(html, /profileRailDieMarkupStandalone\(outputProfile,"output"\)/);
  assert.match(html, /exactBindingDieStyle/);
  for (const behavior of ["standalone-die-seat", "standalone-die-release", "standalone-die-top-open", "standalone-die-bottom-open"]) assert.match(html, new RegExp(`@keyframes ${behavior}`));
});

test("both editions confine the input-to-output change to the operation", async () => {
  const [page, motion, styles, html] = await Promise.all([read("app/page.tsx"), read("app/interface-motion.js"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  for (const phase of ["operation-entry", "stamp-down", "stamp-contact", "stamp-transform", "stamp-up"]) {
    assert.match(motion, new RegExp(phase));
    assert.match(html, new RegExp(phase));
  }
  assert.match(page, /station\.form === "transform" \? "transformingForm"/);
  assert.match(styles, /\.interfaceProcessToken g \{ transition: none; \}/);
  assert.match(styles, /\.interfaceProcessToken\.transforming \.tokenInput/);
  assert.match(styles, /tokenInputEnclosed \.16s ease-in/);
  assert.match(styles, /@keyframes tokenInputEnclosed \{ from \{ opacity: 1; \} to \{ opacity: 0; \} \}/);
  assert.match(styles, /@keyframes tokenOutputReveal \{ 0%,38% \{ opacity: 0; \} 72%,100% \{ opacity: 1; \} \}/);
  assert.match(html, /frame\.form==="transform"\?"transforming-form"/);
  assert.match(html, /\.interface-process-token g\{transition:none\}/);
  assert.match(html, /singleOperationWorkpieceStyle/);
  assert.match(html, /standalone-input-enclosed/);
  assert.match(html, /standalone-output-reveal/);
});

test("both editions render the operation as a four-part stamping sequence", async () => {
  const [page, styles, html] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(page, /className="transformationFrame"/);
  assert.match(page, /className="transformationAnvil"/);
  assert.match(html, /class="transformation-frame"/);
  assert.match(html, /class="transformation-anvil"/);
  assert.match(page, /className="transformationStampFace"/);
  assert.match(page, /className="transformationContact"/);
  const productionPress = page.match(/function ProfileTransformation[\s\S]+?function InterfaceProcessToken/)?.[0] ?? "";
  const standalonePress = html.match(/function profileTransformationMarkupStandalone[\s\S]+?function profileProcessTokenMarkupStandalone/)?.[0] ?? "";
  assert.doesNotMatch(productionPress, /transformationTrack|transformationInput|transformationOutput/);
  assert.doesNotMatch(standalonePress, /transformation-track|transformation-input|transformation-output/);
  for (const phase of ["stamp-down", "stamp-contact", "stamp-transform", "stamp-up"]) assert.match(styles, new RegExp(`data-motion-phase="${phase}"`));
  for (const keyframe of ["interfaceStampDescend", "interfaceStampContact", "interfaceStampRetract", "interfaceWorkpieceCompress", "interfaceWorkpieceRelease"]) assert.match(styles, new RegExp(`@keyframes ${keyframe}`));
  assert.match(styles, /stamp-transform[\s\S]+transformationPress \{ transform: translateY\(13px\)/);
  assert.match(styles, /stamp-transform[\s\S]+interfaceProcessToken \{ transform: translate\(-50%,-50%\) scaleX\(1\.08\) scaleY\(\.72\)/);
  assert.doesNotMatch(styles, /interfaceInvocation\.traceActive \.transformationPress/);
  assert.match(html, /class="transformation-stamp-face"/);
  assert.match(html, /class="transformation-contact"/);
  assert.match(html, /phaseThreeStampingStyle/);
  for (const keyframe of ["standalone-stamp-descend", "standalone-stamp-contact", "standalone-stamp-retract", "standalone-workpiece-compress", "standalone-workpiece-release"]) assert.match(html, new RegExp(`@keyframes ${keyframe}`));
});

test("both editions restyle generated output as a distinct graphite material", async () => {
  const [page, styles, html] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(page, /kind\?: "input" \| "output"/);
  assert.match(page, /kind="output"/);
  assert.match(styles, /\.interfaceProcessToken \.tokenOutput path \{ fill: #3a3a3c; stroke: #1d1d1f; \}/);
  assert.match(styles, /\.profileShape\.outputProfile path \{ fill: #3a3a3c; stroke: #1d1d1f; \}/);
  assert.match(styles, /@keyframes interfaceDeliveredShape \{ 0% \{ fill: #48484a; \} 55% \{ fill: #1d1d1f; \} 100% \{ fill: #3a3a3c; \} \}/);
  assert.match(html, /output-profile/);
  assert.match(html, /phaseFourOutputStyle/);
  assert.match(html, /\.interface-process-token \.token-output path\{fill:#3a3a3c;stroke:#1d1d1f\}/);
  assert.match(html, /@keyframes standalone-delivered-shape\{0%\{fill:#48484a\}55%\{fill:#1d1d1f\}100%\{fill:#3a3a3c\}\}/);
});

test("both editions fit, seat, release, and lift the output from its exact die", async () => {
  const [styles, html] = await Promise.all([read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  for (const keyframe of ["interfaceDieSeat", "interfaceDieRelease", "interfaceDieOpen", "interfaceDieTopOpen", "interfaceDieBottomOpen"]) assert.match(styles, new RegExp(`@keyframes ${keyframe}`));
  assert.match(styles, /output-seated[\s\S]+interfaceProcessToken[\s\S]+scale\(\.92\)/);
  assert.match(styles, /output-release[\s\S]+interfaceProcessToken \{ animation: interfaceDieRelease/);
  for (const keyframe of ["standalone-die-seat", "standalone-die-release", "standalone-die-open", "standalone-die-top-open", "standalone-die-bottom-open"]) assert.match(html, new RegExp(`@keyframes ${keyframe}`));
});

test("both editions finish with a visible delivery handoff", async () => {
  const [motion, styles, html] = await Promise.all([read("app/interface-motion.js"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  for (const phase of ["output-release", "output-snap-out", "output-delivery", "output-received"]) {
    assert.match(motion, new RegExp(phase));
    assert.match(html, new RegExp(phase));
  }
  assert.match(styles, /\.interfaceProcessToken\.fit-received \{ opacity: 0/);
  assert.match(styles, /@keyframes interfaceDeliveryReceive/);
  assert.match(html, /standalone-delivery-receive/);
  assert.match(html, /fit-received\{opacity:0/);
});

test("each declared failure point has a distinct physical animation", async () => {
  const [page, motion, styles, html] = await Promise.all([read("app/page.tsx"), read("app/interface-motion.js"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  assert.match(page, /failure-\$\{failurePoint\}/);
  assert.match(page, /className="tokenFracture"/);
  assert.match(page, /className="transformationFault"/);
  for (const phase of ["input-rejected", "input-binding-rejected", "operation-failed", "output-binding-rejected", "output-rejected"]) {
    assert.match(motion, new RegExp(phase));
    assert.match(html, new RegExp(phase));
  }
  for (const behavior of ["interfaceObjectReject", "interfaceBindingRebound", "interfaceOperationCrush", "interfaceOperationJam", "interfaceDieReject"]) assert.match(styles, new RegExp(behavior));
  assert.match(styles, /input-binding-rejected[\s\S]+inputRailDie/);
  assert.match(styles, /failed:is\(\.failure-input-data-object,\.failure-output-data-object\)/);
  assert.doesNotMatch(styles, /failed:not\(\.failure-input-binding\)/);
  for (const behavior of ["standalone-object-reject", "standalone-binding-rebound", "standalone-operation-crush", "standalone-operation-jam", "standalone-die-reject"]) assert.match(html, new RegExp(behavior));
  assert.match(html, /standaloneDistinctFailureMaterialStyle/);
  assert.match(html, /failed\.failure-input-binding \.token-input path/);
  assert.match(html, /failed\.failure-operation \.token-input path/);
  assert.match(html, /failed\.failure-output-binding \.token-output path/);
  assert.match(html, /failure-\$\{simulationCase\.failurePoint\}/);
});

test("interface animation uses concise action text without a redundant trace paragraph", async () => {
  const [page, motion, html] = await Promise.all([read("app/page.tsx"), read("app/interface-motion.js"), read("outputs/Knowledge-Object-Workbench.html")]);
  for (const phrase of ["Input data object checked.", "Input moving above its binding.", "Input centered over the matching cavity.", "Input descending into the binding.", "Input fully seated in the binding.", "Input held in the matching cavity.", "Input entering operation.", "Press closing over input.", "Input clamped in the press.", "Input enclosed during computation.", "Press opening to reveal output.", "Output centered over its binding.", "Output snapping into binding.", "Output fully seated in the binding.", "Output held in the matching cavity.", "Output lifting out of the binding.", "Output clear of the binding.", "Output moving to delivery.", "Output delivered.", "Input data object rejected.", "Input binding rejected.", "Operation failed.", "Output binding rejected.", "Output data object rejected."]) {
    assert.match(`${page}\n${motion}`, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(page, /className="state3TraceMessage"/);
  assert.match(html, /querySelector\("\.state3-trace-message"\)\?\.remove\(\)/);
});

test("both editions provide responsive and accessible interface interaction", async () => {
  const [page, styles, html] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("outputs/Knowledge-Object-Workbench.html")]);
  for (const token of ["aria-busy", "aria-atomic", "aria-relevant", "aria-controls", "ArrowLeft", "ArrowRight", "Home", "End"]) {
    assert.match(page, new RegExp(token));
    assert.match(html, new RegExp(token));
  }
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(page, /aria-label=\{`Try interface case: \$\{selectedOutcomeLabel\}`\}/);
  assert.match(page, /id="interface-process-description" className="srOnly"/);
  assert.match(page, /The moving shape is decorative/);
  assert.match(page, /id="interface-focus-status"/);
  assert.match(page, /autoFocus aria-label="Close interoperability stages"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.interfaceContract \{ grid-template-columns: 1fr/);
  assert.match(styles, /@media \(pointer: coarse\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  for (const fit of ["fit-rejected", "fit-rebound", "fit-jammed"]) assert.match(styles, new RegExp(`prefers-reduced-motion[\\s\\S]+${fit}`));
  for (const phase of ["input-rejected", "input-binding-rejected", "output-binding-rejected", "output-rejected", "output-received"]) assert.match(styles, new RegExp(`prefers-reduced-motion[\\s\\S]+${phase}`));
  assert.match(styles, /\.interfaceProcessToken\.failed path/);
  assert.match(styles, /stroke: Mark!important/);
  assert.match(html, /interfaceResponsiveAccessibleStyle/);
  assert.match(html, /mountStandalonePhaseAccessibilityBase/);
  assert.match(html, /data-interface-process-description/);
  assert.match(html, /The moving shape is decorative/);
  assert.match(html, /standaloneFailureAccessibilityStyle/);
  assert.match(html, /standalonePhaseEightReducedMotionStyle/);
  assert.match(html, /Try interface case: \$\{selectedLabel\}/);
  assert.match(html, /closeButton\?\.focus\(\)/);
});
