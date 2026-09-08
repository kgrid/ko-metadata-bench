import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createKnowledgeObjectAccessApi } from "../app/ko-access.js";
import { loadInteroperabilityExerciseKit, projectInteroperabilityExerciseState } from "../app/interoperability-exercise.js";
import { createInteroperabilitySimulationHost, fixtureReplaySimulationBinding } from "../app/interoperability-simulation.js";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders FAIR Knowledge Object Bench without a subtitle", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>FAIR Knowledge Object Bench<\/title>/i);
  assert.doesNotMatch(html, /Making Knowledge Objects into FAIR Digital Objects using metadata/);
  assert.doesNotMatch(html, /class="brandMark"/);
  assert.match(html, /Knowledge Objects explorer/);
  assert.doesNotMatch(html, /Knowledge Objects presentation/);
  assert.match(html, /Open .* overview/);
  assert.match(html, /Open .* logic/);
  assert.match(html, /Exercises/);
  assert.match(html, /Metadata/);
  assert.match(html, /Knowledge Objects/);
  assert.match(html, /Knowledge Assembly/);
  assert.match(html, /F exercise/);
  assert.match(html, /A exercise/);
  assert.match(html, /I exercise/);
  assert.match(html, /R exercise/);
  assert.doesNotMatch(html, /Swap sides/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships a self-contained standalone HTML edition", async () => {
  const html = await readFile(
    new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /function renderMetadataRig\(\)/);
  assert.match(html, /A rig to interact with Knowledge Object metadata/);
  assert.match(html, /data-metadata-interact=/);
  assert.match(html, /backdrop\.className="metadata-interact-backdrop"/);
  assert.match(html, /metadata-interact-title/);
  assert.match(html, /pane\.querySelector\("\.pane-head>select"\)\?\.remove\(\)/);
  assert.equal((html.match(/<\/script>/gi) ?? []).length, 2, "embedded KO files must not terminate either standalone script");
  assert.match(html, /<\\\/script>/i, "embedded HTML script terminators must be escaped inside JavaScript strings");
  const parserStart = html.indexOf("<script>") + "<script>".length;
  const parserEnd = html.indexOf("</script>", parserStart);
  const embeddedParser = html.slice(parserStart, parserEnd);
  assert.match(embeddedParser, /g\.N3=f\(\)/);
  assert.match(embeddedParser, /N3Parser/);
  assert.doesNotMatch(embeddedParser, /<!doctype html>|const embeddedAbstractPdf|RDF relationship explorer/);
  assert.match(html, /minObjectCount=1,maxObjectCount=10/);
  assert.match(html, /objectIds=Array\.from\(\{length:embeddedObjectCount\}/);
  assert.match(html, /findabilityFilesForObject=id=>filesForObject\(id\)\.filter/);
  assert.match(html, /for\(const objectId of objectIds\)for\(const file of findabilityFilesForObject\(objectId\)\)/);
  assert.doesNotMatch(html, /function searchAll\(query\)[\s\S]{0,300}for\(const file of filesForObject\(objectId\)\)/);
  assert.match(html, /<input type="search" aria-label="Search knowledge objects" aria-keyshortcuts="Enter" enterkeyhint="search"/);
  assert.match(html, /<button type="submit">Search<\/button>/);
  assert.match(html, /input\.addEventListener\("input",\(\)=>\{clearButton\.hidden=!input\.value;if\(!input\.value\)\{currentResults=\[\];searched=false;submittedQuery="";paintResults\(\)\}\}\)/);
  assert.match(html, /form\.addEventListener\("submit",event=>\{event\.preventDefault\(\);submittedQuery=input\.value\.trim\(\);if\(!submittedQuery\)\{currentResults=\[\];searched=false\}else\{currentResults=searchAll\(submittedQuery\);searched=true\}paintResults\(\)\}\)/);
  assert.match(html, /const objectFolderNames=\["Wagner DFU severity score KO","HBOT treatment decision KO","HBOT regimen burden KO","DFU prognostic indicator KO"\]/);
  assert.doesNotMatch(html, /objectNames=\{1:"Knowledge Object 1"/);
  assert.match(html, /Instrument set: \$\{embeddedObjectCount\} embedded knowledge/);
  assert.match(html, /Knowledge Objects explorer/);
  assert.doesNotMatch(html, /Knowledge Objects presentation/);
  assert.match(html, /circular file map/);
  assert.match(html, /<div class="ko-map"><div class="ko-map-canvas">/);
  assert.doesNotMatch(html, /<section class="ko-abstract-face"><header>/);
  assert.match(html, /class="ko-shade-file-count"/);
  assert.match(html, /fillText\(objectFiles\.length\+" FILES",cx,cy\)/);
  assert.doesNotMatch(html, /fillText\("KO "\+objectId/);
  assert.match(html, /Read only/);
  assert.match(html, /id="knowledgeObjectsButton" aria-pressed="true"/);
  assert.match(html, /id="filesReturn" aria-pressed="false"/);
  assert.match(html, /openKnowledgeObjects\(\);updateHeader\(\)/);
  assert.match(html, /function openKnowledgeObjects\(\)/);
  assert.doesNotMatch(html, /openKnowledgeObjects\(1,"grid"\)/);
  assert.match(html, /<details class="ko-object-shade" data-ko-object="\$\{objectId\}">/);
  assert.match(html, /class="facet-list ko-summary-facet-list"/);
  assert.match(html, /\["Knowledge Elements",koKnowledgeElementCount\(objectId\)\]/);
  assert.match(html, /\["Method",koMethod\(objectId\)\]/);
  assert.match(html, />Overview<\/button>/);
  assert.match(html, />Logic<\/button>/);
  assert.doesNotMatch(html, />Picture<\/button>/);
  assert.match(html, /function openKnowledgeObjectGraphicView\(objectId,kind="overview"\)/);
  assert.match(html, /function openKnowledgeObjectFilesView\(objectId\)/);
  assert.match(html, /ko-overview-content/);
  assert.match(html, /data-ko-graphic="logic"/);
  assert.match(html, /class="ko-fullscreen-files-content"/);
  assert.match(html, /const fileLayers=\[\{id:"metadata",label:"Metadata"/);
  assert.doesNotMatch(html, /Supporting assets/);
  assert.match(html, /function fileLayerId\(file\)/);
  assert.match(html, /if\(\["md","mdx"\]\.includes\(extension\)\)return"documentation"/);
  assert.match(html, /ringWidth=\(scale-core-gap\*\(fileLayers\.length\+1\)\)\/fileLayers\.length/);
  assert.match(html, /return"documentation"/);
  assert.doesNotMatch(html, /class="ko-layer-legend"/);
  assert.match(html, /label:"Metadata"/);
  assert.match(html, /label:"Docs"/);
  assert.doesNotMatch(html, /label:"Specs"/);
  assert.match(html, /label:"Code"/);
  assert.match(html, /label:"Tests"/);
  assert.match(html, /four-layer circular file map: Metadata, Docs, Code, and Tests/);
  assert.match(html, /drawRadialCategoryControlStandalone\(context,cx,cy,middleRadius,layer\.label/);
  assert.match(html, /focusedRadialLayerGeometryStandalone/);
  assert.match(html, /focusedLayerId=null/);
  assert.match(html, /context\.strokeStyle="#fff";context\.lineWidth=3/);
  assert.match(html, /fileFormatLabel\(selected\)/);
  assert.match(html, /context\.fillText\(label,cx,cy-middleRadius\+\.5\)/);
  assert.match(html, /Findability exercise/);
  assert.match(html, /class="view-title"><div class="search-mark">F<\/div><h2>Findability<\/h2>/);
  assert.match(html, /class="view-title"><div class="search-mark">A<\/div><h2>Accessibility<\/h2>/);
  assert.match(html, /class="view-title"><div class="search-mark">I<\/div><h2>Interoperability<\/h2>/);
  assert.match(html, /class="view-title"><div class="search-mark">R<\/div><h2>Reusability<\/h2>/);
  assert.match(html, /class="view-title"><div class="ko-instrument-mark">KOs<\/div><h2>Knowledge Objects<\/h2>/);
  assert.match(html, /\.view-title h2\{margin:0;color:#1d1d1f;font-size:28px;font-weight:600;letter-spacing:-\.03em\}/);
  assert.match(html, /Search knowledge object metadata/);
  assert.doesNotMatch(html, /Search over Knowledge Object metadata to find Knowledge Objects/);
  assert.doesNotMatch(html, /Search across embedded knowledge objects/);
  assert.doesNotMatch(html, /Search result presentation|search-view-toggle|renderWebResults|web-results/);
  assert.match(html, /renderGroupedResults\(currentResults,searched\)/);
  assert.match(html, /paintResults\(\);input\.focus\(\)/);
  assert.doesNotMatch(html, /Enter search terms to inspect all four knowledge objects/);
  assert.doesNotMatch(html, /class="results-summary"/);
  assert.doesNotMatch(html, /findabilityMetadataRichness|Findability Metadata Richness|<b>FMR<\/b>|metadata-richness|findability-method/);
  assert.match(html, /function findabilityFacets\(objectId\)/);
  assert.match(html, /Canonical IRI: /);
  assert.match(html, /function findabilityIdentityValues\(objectId\)/);
  assert.match(html, /class="identity-projection"/);
  assert.match(html, /\["Identifier","Version","Type"\]/);
  assert.match(html, /predicates:\[\],fixedValues:identityValues/);
  assert.match(html, /function renderFindabilityFacets\(objectId\)/);
  assert.match(html, /Identity & version/);
  assert.match(html, /Technical characteristics/);
  assert.match(html, /Full Name & Description/);
  assert.match(html, /normalizeGeneratedAcronyms=value=>value\.replace\(\/\\b\(dfu\|hbot\)\\b\/gi,word=>word\.toUpperCase\(\)\)/);
  assert.match(html, /\^\(Computational method\|Programming language\):/);
  assert.match(html, /findability-facet-row\.key-value/);
  assert.match(html, /Collection & indexing/);
  assert.match(html, /Containing collection:/);
  assert.match(html, /controlledSubjectLabels=\{D017719:"Diabetic Foot"/);
  assert.match(html, /function findabilitySearchTerms\(objectId\)/);
  assert.match(html, /class="search-term-projection"/);
  assert.match(html, /class="keyword-tags"/);
  assert.match(html, /Show \$\{searchTerms\.keywords\.length-6\} more/);
  assert.match(html, /data-findability-results=/);
  assert.match(html, /function openFindabilityResults\(objectId,query,results\)/);
  assert.match(html, /class="findability-results-dialog"/);
  assert.match(html, /openFindabilityResults\(objectId,submittedQuery,currentResults\.filter/);
  assert.match(html, /class="findability-results-query"/);
  assert.match(html, /<span>Searched for<\/span><q>\$\{escapeHtml\(query\)\}<\/q>/);
  assert.match(html, /class="result-count match-idle" disabled>Matches<\/button>/);
  assert.match(html, /class="result-count match-zero" disabled>0 matches<\/button>/);
  assert.match(html, /class="findability-audit-button" data-findability-audit="\$\{objectId\}">Audit<\/button>/);
  assert.match(html, /const findabilityAuditDefinitions=\[/);
  assert.match(html, /function runFindabilityAudit\(objectId\)/);
  assert.match(html, /function openFindabilityAudit\(objectId\)/);
  assert.match(html, /Running Findability Audit/);
  assert.match(html, /Preparing 16 searches/);
  assert.match(html, /Searching findability metadata/);
  assert.match(html, /Comparing results with expectations/);
  assert.match(html, /findability-audit-acquisition/);
  assert.match(html, /data-findability-audit=/);
  assert.match(html, /class="findability-audit-table"/);
  assert.match(html, /<th>Searched for<\/th><th>Expected<\/th>/);
  assert.match(html, /<th>Why this result is expected<\/th>/);
  assert.match(html, /class="audit-rationale"/);
  assert.match(html, /rationale:definition\.rationales\[objectId-1\]/);
  assert.match(html, /Unexpected match—the term appears in this KO’s findability metadata despite being outside its declared discovery focus\./);
  assert.match(html, /This KO classifies DFU severity; HBOT is not its declared subject or purpose\./);
  assert.doesNotMatch(html, /rationale:"Tests /);
  assert.match(html, /expectedFirst=\[\.\.\.expectedRows\]\.sort/);
  assert.match(html, /notExpected=rows\.filter\(row=>!row\.expected\)\.sort/);
  assert.match(html, /class="audit-table-section-gap"/);
  assert.match(html, /results\.push\(\{objectId,file,line:lineIndex\+1,snippet,highlights:searchHighlightRanges\(snippet,keywords,exactPhrase\),\.\.\.match\}\)\}\}\}return results\.sort/);
  assert.match(html, /function renderHighlightedSnippet\(result\)/);
  assert.match(html, /class="search-match-highlight"/);
  assert.match(html, /function groupFindabilityResults\(results\)/);
  assert.match(html, /label:"EXACT MATCHES"/);
  assert.match(html, /label:"CLOSE MATCHES"/);
  assert.match(html, /label:"PARTIAL MATCHES"/);
  assert.match(html, /class="search-result-category"/);
  assert.match(html, /function isCloseMatch\(a,b\)\{const shorterLength=Math\.min\(a\.length,b\.length\),longerLength=Math\.max\(a\.length,b\.length\);if\(shorterLength<4\|\|longerLength-shorterLength>2\)return false;const distance=editDistance\(a,b\),editLimit=longerLength>=8\?2:1;return distance<=editLimit&&distance\/longerLength<=\.25\}/);
  assert.doesNotMatch(html, /sharedPrefix/);
  assert.match(html, /\.result-group\{overflow:visible\}/);
  assert.match(html, /facets=findabilityFacets\(objectId\),declaredFacets=facets\.filter\(facet=>facet\.values\.length\)\.length/);
  assert.match(html, /declaredFacets\?"":" zero-facets"/);
  assert.doesNotMatch(html, /group\.length\?"open":""/);
  assert.match(html, /button type="button" class="result-count match-positive" data-findability-results/);
  assert.match(html, /class="facet-count \$\{declaredFacets===facets\.length\?"has-facets":"incomplete-facets"\}"/);
  assert.match(html, /\$\{declaredFacets\} Facets/);
  assert.match(html, /\.result-group\.zero-facets,\.result-group\.zero-facets>summary\{background:#fff8f7\}/);
  assert.match(html, /\.result-group>summary \.facet-count\.has-facets\{background:#e5f3e8;color:#356b43\}/);
  assert.match(html, /\.result-group>summary \.facet-count\.incomplete-facets\{background:#fff8f7;color:#b42318\}/);
  assert.match(html, /\.result-group>summary \.result-count\.match-positive\{border:1px solid #34c759\}/);
  assert.match(html, /\.result-group>summary \.result-count\.match-zero\{border:1px solid #ff3b30\}/);
  assert.match(html, /\.findability-facet-row\.missing,\.facet-row\.missing,\.boundary-questions details\.missing-facet\{background:#fff8f7\}/);
  assert.match(html, /class="\$\{item\.answered\?"declared-facet":"missing-facet"\}"/);
  assert.match(html, /\.search-results\{width:min\(920px,100%\)\}/);
  assert.match(html, /\.result-group>summary strong\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(html, /Reusability exercise/);
  assert.match(html, /See how metadata support reusability/);
  assert.doesNotMatch(html, /aria-label="Reusability presentation"/);
  assert.match(html, /What is this knowledge object intended to accomplish\?/);
  assert.match(html, /What evidence supports the knowledge represented by it\?/);
  assert.match(html, /embeddedObjectCount=Math\.min\(maxObjectCount,Math\.max\(minObjectCount,4\)\)/);
  assert.doesNotMatch(html, /Session changes|changedCount|class="dot"|class="green"|>Modified</);
  assert.doesNotMatch(html, /localStorage|sessionStorage|draftStorageKey/);
  assert.match(html, /Public access; no authentication or payment required\./);
  assert.match(html, /schema\.org\/urlTemplate/);
  assert.match(html, /schema\.org\/potentialAction/);
  assert.match(html, /data-ko-access-id/);
  assert.match(html, /FDO Bench KO Access API 1\.0/);
  assert.match(html, /relationship:\{\.\.\.getPredicatePresentation\(statement\.predicate\),human:name\.object\.value\}/);
  assert.match(html, /objectName=id=>formatFolderName\(objectFolderName\(id\)\)/);
  assert.match(html, /fileNamesByObject/);
  assert.match(html, /Meggitt-Wagner_CKS_One-Page_Clinical-Knowledge_Summary\.docx/);
  assert.match(html, /\[Extracted DOCX text\]/);
  assert.match(html, /Maximal Findability Profile/);
  assert.match(html, /persistent-header\{position:sticky;top:0;z-index:100\}/);
  assert.match(html, /id="abstractButton">Workshop Abstract<\/button>/);
  assert.match(html, /class="files-return" id="filesReturn" aria-pressed="false">Metadata Rig<\/button>/);
  assert.match(html, /id="knowledgeObjectsButton"[^>]*>Knowledge Objects<\/button><button[^>]*id="filesReturn"[^>]*>Metadata Rig<\/button><\/div><div class="exercise-control-cluster">/);
  assert.match(html, /<span class="label">Metadata Exercises<\/span>/);
  assert.doesNotMatch(html, /filesReturn\.hidden/);
  assert.match(html, /filesReturn\.classList\.remove\("active-destination"\)/);
  assert.match(html, /filesReturn\.classList\.add\("active-destination"\)/);
  assert.match(html, /data:application\/pdf;base64,JVBER/);
  assert.match(html, /Workshop Abstract/);
  assert.match(html, /Minimal Interoperability Profile/);
  assert.match(html, /Interoperability exercise/);
  assert.match(html, /See how metadata bring greater interoperability/);
  assert.match(html, /Interoperability details/);
  assert.doesNotMatch(html, /<span>Interoperability Boundary Panel<\/span>|<div class="capability-boundary">|<strong>Knowledge Object<\/strong>/);
  assert.match(html, /What does this capability mean\?/);
  assert.match(html, /What objects does this capability exchange\?/);
  assert.match(html, /How do we use this capability\?/);
  assert.doesNotMatch(html, /Can we answer\?/);
  assert.match(html, /await knowledgeObject\.run\(input\)/);
  assert.doesNotMatch(html, /Interoperability description incomplete/);
  assert.doesNotMatch(html, /Boundary explicitly described/);
  assert.doesNotMatch(html, /class="interoperability-status"/);
  assert.doesNotMatch(html, /class="boundary-complete"/);
  assert.match(html, /This capability has an explicit interoperability boundary\./);
  assert.match(html, /interoperability\.exercise\.json/);
  assert.doesNotMatch(html, /Capability execution/);
  assert.doesNotMatch(html, /Execution ≠ Interoperability/);
  assert.match(html, /Metadata overview/);
  assert.match(html, /Exercise detail/);
  assert.match(html, /Independent interoperability exercise component/);
  assert.match(html, /data-interoperability-mode="published"/);
  assert.match(html, /data-interoperability-mode="educational"/);
  assert.match(html, /interoperabilityEducationalModes=\{\}/);
  assert.match(html, /function projectInteroperabilityExerciseState\(state\)/);
  assert.match(html, /contractExecutionAvailable:visible\.interface/);
  assert.match(html, /Runs through the declared interoperability contract/);
  assert.match(html, /Object profiles: \$\{runState>=2\?"✓ Carried by the input and output":"Not used"\}/);
  assert.match(html, />Overview<\/button>/);
  assert.match(html, />Detail<\/button>/);
  assert.match(html, />Reset<\/button>/);
  assert.match(html, /data-begin-object/);
  assert.doesNotMatch(html, />Boundary opaque</);
  assert.match(html, /Next step/);
  assert.match(html, /Complete the previous step first/);
  assert.match(html, /The primary exercise reveals each boundary facet in sequence/);
  assert.match(html, /✓ Defined/);
  assert.match(html, /Add semantic description/);
  assert.match(html, /Add object profiles/);
  assert.match(html, /Add interface description/);
  assert.match(html, /data-repair-facet/);
  assert.match(html, /function getPublishedInteroperabilityModel\(objectId\)/);
  assert.match(html, /function getInteroperabilityExerciseKit\(objectId\)/);
  assert.match(html, /function getInteroperabilityExerciseDiscovery\(objectId\)/);
  assert.match(html, /Educational component unavailable/);
  assert.match(html, /Published KO metadata remains available/);
  assert.match(html, /data-semantic-details="\$\{fieldIndex===0\?"input":"output"\}"/);
  assert.match(html, /View actual \$\{fieldIndex===0\?"inputs":"outputs"\}/);
  assert.match(html, /function openSemanticDetails\(objectId,role\)/);
  assert.match(html, /class="semantic-element-list"/);
  assert.match(html, /profile\.properties/);
  assert.match(html, /Is extensive gangrene present involving most or all of the foot\?/);
  assert.match(html, /Meaning of the first question|member\.meaning/);
  assert.match(html, /semantic-value-meanings/);
  assert.match(html, /loaded\.status==="absent"/);
  assert.match(html, /interoperabilitySimulationSessions=\{\}/);
  assert.doesNotMatch(html, /interoperabilityRepairs=|interoperabilitySimulationStates=|interoperabilityExecutionResults=/);
  assert.match(html, /Interoperability execution simulation/);
  assert.match(html, /renderInteroperabilityExecutionAlwaysOpenBase/);
  assert.doesNotMatch(html, /Simulate Raw Execution/);
  assert.doesNotMatch(html, /Simulate Contract Execution/);
  assert.match(html, /data-state-choice="\$\{candidate\}"/);
  assert.match(html, /Show interoperability simulation State \$\{candidate\}/);
  assert.match(html, /Move freely among four interoperability states/);
  assert.match(html, /semantic-raw-readout/);
  assert.match(html, /semantic-transcript/);
  assert.match(html, /semantic-document/);
  assert.match(html, /synthesizeSemanticDocumentStandalone/);
  assert.doesNotMatch(html, /Semantic annotation only · no data-object profile/);
  assert.match(html, /state2-projection-toggle/);
  assert.match(html, /data-state2-projection="table"/);
  assert.match(html, /data-state2-projection="source"/);
  assert.match(html, /Input table source/);
  assert.match(html, /Output table source/);
  assert.match(html, /state2ProjectionSourceStandalone/);
  assert.match(html, /state3-object-shade/);
  assert.match(html, /renderState3ObjectShadeStandalone/);
  assert.match(html, /replaceFirstDivByClass/);
  assert.match(html, /Meaning carried with the value/);
  assert.match(html, /Question meaning not supplied/);
  assert.match(html, /Meaning described — data objects not yet defined/);
  assert.match(html, /No formal data object is defined at State 1/);
  assert.doesNotMatch(html, /RAW · OPAQUE/);
  assert.doesNotMatch(html, /CONTRACT · DECLARED/);
  assert.doesNotMatch(html, /Simulation only/);
  assert.match(html, /runs-badge[^>]*>Simulation</);
  assert.match(html, /data-execution-state="\$\{runState\}"/);
  assert.match(html, /renderStandaloneInterfaceSpecification/);
  assert.match(html, /Interface specification/);
  assert.match(html, /Applies to/);
  assert.match(html, /Error binding/);
  assert.match(html, /The specification defines both resolution and rejection/);
  assert.match(html, /Defined outcomes/);
  assert.match(html, /INVALID_INPUT/);
  assert.match(html, /CONTRACT_MISMATCH/);
  assert.match(html, /EXECUTION_FAILED/);
  assert.match(html, /No KO implementation was invoked/);
  assert.match(html, /Host-supplied simulation binding/);
  assert.match(html, /function createInteroperabilitySimulationHost\(\)/);
  assert.match(html, /interoperabilitySimulation:interoperabilitySimulationHost/);
  assert.match(html, /status:"binding-unavailable"/);
  assert.match(html, /same input and output are progressively annotated/);
  assert.match(html, /Host-supplied simulation binding/);
  assert.match(html, /wagner-interoperability-exercise\/examples\/raw-input\.json/);
  assert.match(html, /wagner-interoperability-exercise\/examples\/expected-output\.json/);
  assert.match(html, /function loadInteroperabilityExerciseKit\(\{files,readText\}\)/);
  assert.match(html, /configFiles\.length!==1/);
  assert.match(html, /parseState\(config\.simulationState/);
  assert.match(html, /Artifact reference escapes the exercise root/);
  assert.match(html, /rootFiles\.has\(path\)/);
  assert.match(html, /resolveJson\("execution\/raw-execution\.json"/);
  assert.match(html, /resolveJson\(contractManifest\.input\?\.profileArtifact/);
  assert.match(html, /function getInteroperabilityExerciseDiscovery\(objectId\)\{[\s\S]{0,500}loadInteroperabilityExerciseKit/);
  assert.match(html, /function validateInteroperabilityExerciseTarget\(loaded,target\)/);
  assert.match(html, /function parseTypedInteroperabilityExerciseArtifacts\(loaded\)/);
  assert.match(html, /function selectedInteroperabilityTarget\(objectId\)/);
  assert.match(html, /Exercise target identifier does not match the selected knowledge object/);
  assert.match(html, /Exercise target version does not match the selected knowledge object/);
  assert.match(html, /Exercise target specification does not match the selected knowledge object/);
  assert.doesNotMatch(html, /rawInput:readJson\(\[\/\\\/execution\\\/raw-input/);
  assert.doesNotMatch(html, /universally interoperable/i);
  assert.match(html, /Previous knowledge object/);
  assert.match(html, /Next knowledge object/);
  assert.doesNotMatch(html, /aria-label="Interoperability presentation"/);
  assert.match(html, /View each KO Individually/);
  assert.doesNotMatch(html, /data-ko-view/);
  assert.match(html, /files-return/);
  assert.match(html, /Exact phrase/);
  assert.match(html, /Close match/);
  assert.match(html, /function hasExactTokenSequence\(tokens,keywords\)/);
  assert.match(html, /if\(hasExactTokenSequence\(tokens,keywords\)\)return\{rank:0,kind:"Exact phrase"\}/);
  assert.doesNotMatch(html, /if\(normalized\.includes\(query\)\)return\{rank:0,kind:"Exact phrase"\}/);
  assert.match(html, /longerLength-shorterLength>2/);
  assert.doesNotMatch(html, /source:"filename"/);
  assert.doesNotMatch(html, /source:"projection"/);
  assert.doesNotMatch(html, /projectedLines=buildHumanRdfProjection/);
  assert.doesNotMatch(html, /result\.source===/);
  assert.match(html, /clear-search/);
  assert.match(html, /result-group/);
  assert.match(html, /findability-grid/);
  assert.match(html, /Accessibility exercise/);
  assert.match(html, /Get knowledge objects using declared access methods/);
  assert.doesNotMatch(html, /Conformant web access points declared by each knowledge object/);
  assert.match(html, /getAccessibilityLinks/);
  assert.match(html, /window\.FDOBench=Object\.freeze\(\{\.\.\.window\.FDOBench,access:koAccessApi\}\)/);
  assert.match(html, /prepareKnowledgeObjectZip/);
  assert.match(html, /savePreparedDownload/);
  assert.match(html, /downloadKnowledgeObject/);
  assert.match(html, /fdobench:knowledge-object-download/);
  assert.match(html, /accessPassword="Texas"/);
  assert.match(html, /type="password"/);
  assert.match(html, /Password entry is case-sensitive/);
  assert.match(html, /authentication-required/);
  assert.match(html, /authentication-failed/);
  assert.match(html, /authentication-cancelled/);
  assert.match(html, /authenticatedPreparations=new WeakSet/);
  assert.match(html, /knowledge-object-not-found/);
  assert.match(html, /-working-copy/);
  assert.match(html, /"1\/Meggitt-Wagner_CKS_One-Page_Clinical-Knowledge_Summary\.docx":"UEsDB/);
  assert.match(html, /"1\/kgrid\.org_Meggitt_Wagner_Questionnaire_CKS_Version_1_0\.docx":"UEsDB/);
  assert.match(html, /Object\.hasOwn\(drafts,key\(object\.sourceIndex,path\)\)/);
  assert.match(html, /accessPredicates=new Set\(\["https:\/\/schema\.org\/url","https:\/\/schema\.org\/urlTemplate","https:\/\/schema\.org\/distribution","https:\/\/schema\.org\/contentUrl","https:\/\/schema\.org\/downloadUrl"\]\)/);
  assert.match(html, /statement\.predicate\.value==="https:\/\/schema\.org\/potentialAction"/);
  assert.match(html, /human:"access instance"/);
  assert.match(html, /\["https:\/\/schema\.org\/urlTemplate","access route"\]/);
  assert.match(html, /\["https:\/\/schema\.org\/description","access conditions"\]/);
  assert.match(html, /\["https:\/\/schema\.org\/name","access protocol"\]/);
  assert.match(html, /isAccessInstance=statement\.relationship\.human==="access instance"/);
  assert.match(html, /subordinateChildren=isAccessInstance\?statement\.value\.children/);
  assert.match(html, /\.human-rdf-table th:nth-child\(3\)\{width:52%\}/);
  assert.match(html, /white-space:normal;overflow-wrap:anywhere;word-break:break-word/);
  assert.doesNotMatch(html, /rdfCandidates=\[\.\.\.graph\.terms\.values\(\)\]/);
  assert.doesNotMatch(html, /links\.length\?"open":""/);
  assert.doesNotMatch(html, /declared\?"open":""/);
  assert.match(html, /accessibility-card\$\{links\.length\?"":" zero-links"\}/);
  assert.match(html, /links\.length===1\?"option":"options"/);
  assert.match(html, /\.accessibility-card\.zero-links,\.accessibility-card\.zero-links>summary\{background:#fff8f7\}/);
  assert.match(html, /\.accessibility-card>summary span\.has-links\{padding:3px 8px;border-radius:10px;background:#e5f3e8;color:#356b43\}/);
  assert.doesNotMatch(html, /Accessibility presentation|data-accessibility-view|data-accessibility-direction|accessibility-single/);
  assert.match(html, /function openAccessibility\(\)\{workspace\.innerHTML=renderAccessibility\(\)/);
  assert.match(html, /openReusability\(1,"single"\)/);
  assert.match(html, /Subject<\/th><th>Predicate<\/th><th>Object/);
  assert.match(html, /formatPredicateForFiles/);
  assert.match(html, /new N3\.Parser\(\{format:"text\/turtle"\}\)/);
  assert.match(html, /function buildCanonicalRdfGraph\(source\)/);
  assert.match(html, /terms=new Map\(\)/);
  assert.match(html, /statements\.push\(\{id:subject\.id/);
  assert.match(html, /allTriples=buildCanonicalRdfGraph\(source\)\.statements/);
  assert.match(html, /function resolveDeterministicRdfLabels\(graph\)/);
  assert.match(html, /labelPredicates=\["https:\/\/schema\.org\/name","http:\/\/www\.w3\.org\/2004\/02\/skos\/core#prefLabel","http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#label"\]/);
  assert.match(html, /humanLabel:"",labelSource:"unresolved"/);
  assert.match(html, /languageRank=language==="en"\|\|language\.startsWith\("en-"\)\?0/);
  assert.match(html, /return resolveDeterministicRdfLabels\(\{source,namespaces,terms,statements,comments,diagnostics\}\)/);
  assert.match(html, /predicatePresentationRegistry=new Map/);
  assert.match(html, /human:"input",compact:"schema:object",facet:"interoperability",order:300/);
  assert.match(html, /human:"evidence",compact:"schema:citation",facet:"reusability",order:450/);
  assert.match(html, /human:"provenance",compact:"prov:has_provenance",facet:"reusability",order:430/);
  assert.match(html, /function getPredicatePresentation\(term\)/);
  assert.match(html, /presentationLabel=presentation\.human/);
  assert.match(html, /presentationSource=predicatePresentationRegistry\.has/);
  assert.match(html, /facet:"general",order:1000/);
  assert.match(html, /function projectRdfValue\(graph,term,visited=new Set\(\),depth=0\)/);
  assert.match(html, /term\.termType==="Literal"\)return\{kind:"literal",display:term\.value/);
  assert.match(html, /term\.termType!=="BlankNode"\)return\{kind:"resource"/);
  assert.match(html, /visited\.has\(term\.id\)\|\|depth>=6/);
  assert.match(html, /kind:"nested",display:explicitName\|\|term\.humanLabel\|\|"Nested resource"/);
  assert.match(html, /inlineChildren=value\.children\.filter\(child=>child\.predicate\.value!=="https:\/\/schema\.org\/valueReference"\)/);
  assert.match(html, /class="human-rdf-subordinate-row"/);
  assert.match(html, /aria-label="Subordinate relationship"/);
  assert.match(html, /Supporting RDF relationships/);
  assert.match(html, /child\.value\.rdfTerm\.compact/);
  assert.match(html, /function projectRdfStatement\(graph,statement/);
  assert.match(html, /function buildHumanRdfProjection\(graph\)/);
  assert.match(html, /subject\.termType!=="BlankNode"/);
  assert.match(html, /statement\.predicate\.value==="https:\/\/schema\.org\/additionalProperty"&&statement\.object\.termType==="BlankNode"/);
  assert.match(html, /human:name\.object\.value/);
  assert.match(html, /"https:\/\/schema\.org\/name","https:\/\/schema\.org\/value"/);
  assert.match(html, /function buildHumanRdfProjection\(graph\)\{return graph\.statements\.filter\(statement=>statement\.subject\.termType!=="BlankNode"\)\.map\(statement=>projectRdfStatement\(graph,statement\)\)\}/);
  assert.doesNotMatch(html, /a\.projected\.relationship\.order-b\.projected\.relationship\.order/);
  assert.doesNotMatch(html, /children=graph\.statements[^\n]*\.sort\(/);
  assert.match(html, /function renderHumanRdfForFiles\(source\)/);
  assert.match(html, /data-rdf-view="human" class="active"/);
  assert.doesNotMatch(html, />Compact RDF<\/button>/);
  assert.match(html, /data-rdf-view="source"/);
  assert.match(html, /RDF table projection/);
  assert.match(html, />Table<\/button><button type="button" data-rdf-view="source"/);
  assert.match(html, /Human view unavailable/);
  assert.match(html, /Invalid Turtle source/);
  assert.match(html, /Your source has been preserved/);
  assert.match(html, /function renderHumanRdfForFiles\(source\).*graph\.diagnostics\.length/);
  assert.match(html, /const updateRdfValidity=/);
  assert.match(html, /graphButton\.disabled=diagnostics\.length>0/);
  assert.match(html, /Authoritative Turtle source/);
  assert.match(html, /Relationship<\/th><th>Value/);
  assert.match(html, /function renderRdfTermButton\(term,label\)/);
  assert.match(html, /data-rdf-term/);
  assert.match(html, /function showRdfTermDetails\(view,button\)/);
  assert.match(html, /Term details/);
  assert.match(html, /RDF term type/);
  assert.match(html, /Compact identifier/);
  assert.match(html, /Authoritative term/);
  assert.match(html, /Nested structure/);
  assert.match(html, /<dt>Language<\/dt>/);
  assert.match(html, /<dt>Datatype<\/dt>/);
  assert.match(html, /Rendering Issue/);
  assert.match(html, /relateButton\.textContent="Graph"/);
  assert.match(html, /button\.textContent==="Graph"/);
  assert.doesNotMatch(html, /relateButton\.textContent="Relate"|button\.textContent==="Relate"/);
  assert.match(html, /openRelationshipDialog/);
  assert.match(html, /RDF relationship explorer/);
  assert.match(html, /Node-and-edge graph/);
  assert.doesNotMatch(html, /data-presentation="graph"|data-presentation="lanes"/);
  assert.doesNotMatch(html, /state=\{detail,presentation:"graph"/);
  assert.match(html, /class="relationship-node-graph"/);
  assert.match(html, /class="graph-edge-line"/);
  assert.match(html, /class="graph-node /);
  assert.match(html, /marker-end="url\(#rdf-arrow\)"/);
  assert.match(html, /Interactive RDF node and edge graph/);
  assert.match(html, /relationship-dialog>header \.relationship-close\{width:30px;height:30px;margin-left:auto/);
  assert.doesNotMatch(html, /data-detail="structure"|data-detail="complete"|aria-label="Graph detail"/);
  assert.match(html, /data-control="depth"/);
  assert.doesNotMatch(html, /data-control="direction"|<label>Direction|state\.direction/);
  assert.match(html, /if\(!outgoing&&!incoming\)continue/);
  assert.match(html, /data-control="literals"\]\x27\)\?\.closest\("label"\)\?\.remove\(\)/);
  assert.match(html, /data-control="types"\]\x27\)\?\.closest\("label"\)\?\.remove\(\)/);
  assert.match(html, /data-action="fit"\]\x27\)\?\.remove\(\)/);
  assert.match(html, /literals:"show",types:true/);
  assert.doesNotMatch(html, /Reset focus/);
  assert.match(html, /textContent="Inspector"/);
  assert.match(html, /Open inspector/);
  assert.match(html, /Close inspector/);
  assert.match(html, /inspectorOpen:false/);
  assert.match(html, /data-action="inspector-toggle"/);
  assert.match(html, /aria-controls="relationship-evidence-inspector"/);
  assert.match(html, /data-action="inspector-close"/);
  assert.match(html, /relationship-workspace\.inspector-open/);
  assert.match(html, /clip-path:inset\(0 100% 0 0\)/);
  assert.match(html, /Source statement/);
  assert.doesNotMatch(html, /Focus here/);
  assert.doesNotMatch(html, /Show related/);
  assert.doesNotMatch(html, /focusPath|data-focus|data-crumb|data-action="reset"/);
  assert.match(html, /Accessible relationship list/);
  assert.doesNotMatch(html, /Predicate-lane RDF relationship map|>Lanes<|data-expand/);
  assert.match(html, /rdf-statement-select/);
  assert.match(html, /data-statement-id/);
  assert.doesNotMatch(html, /force=900|requestAnimationFrame\(tick/);
  assert.match(html, /typeMap=new Map/);
  assert.match(html, /statement\.predicate\.value!==RDF_TYPE/);
  assert.match(html, /term\.termType==="Literal"/);
  assert.match(html, /getPredicatePresentation\(statement\.predicate\)\.human/);
  assert.match(html, /Resetting will discard edits in progress\./);
  assert.doesNotMatch(html, /bar\.insertBefore\(n,controls\)|class="modified"|title="Modified"/);
  assert.doesNotMatch(html, /<div class="editor-bar"><i class="green"><\/i><span>\$\{s\.file\}<\/span>/);
  assert.doesNotMatch(html, /Reset file|Edit source/);
  assert.match(html, /accessibility-card reusability-card/);
  assert.match(html, /zero-facets/);
  assert.match(html, /has-facets/);
  assert.match(html, /\$\{declared\} Facets/);
  assert.doesNotMatch(html, /\$\{declared\} of 6 declared/);
  assert.match(html, /accessibility-card interoperability-panel/);
  assert.match(html, /status:accessStatus\(conditions\)/);
  assert.match(html, /legacyConditions=graph\.statements/);
  assert.match(html, /Authentication required/);
  assert.match(html, /access-tag/);
  assert.match(html, /candidate\.predicate\.compact===facet\.property/);
  assert.match(html, /projectRdfValue\(graph,statement\.object\)\.display/);
  assert.match(html, /let drafts=\{\}/);
  assert.match(html, /graphicAbstractFile=files/);
  assert.match(html, /graphic\\\.abstract\\\.webp/);
  assert.match(html, /graphic\\\.abstract\\\.png/);
  assert.match(html, /"image\/webp":"image\/png"/);
  assert.doesNotMatch(html, /find\(file=>file\.toLowerCase\(\)==="graphic\.abstract\.png"\)/);
  assert.match(html, /https:\/\/github\.com\/kgrid-objects/);
  assert.match(html, /n===other\.object\?"disabled"/);
  assert.doesNotMatch(html, /<(?:link|script)[^>]+(?:href|src)=/i);
  for (const filename of [
    "README.md",
    "graphic.abstract.webp",
    "metadata.json",
    "accessibility.metadata.txt",
    "findability.metadata.txt",
    "interoperability.metadata.txt",
    "reusability.metadata.txt",
  ]) assert.match(html, new RegExp(filename.replaceAll(".", "\\.")));
});

test("browser abstract dialog uses the embedded PDF rather than a downloadable route", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const embeddedAbstractPdf="data:application\/pdf;base64,JVBER/);
  assert.match(source, /<iframe[^>]+src=\{embeddedAbstractPdf\}/);
  assert.doesNotMatch(source, /src="\/Representing_Computable_Biomedical_Knowledge_Monochromatic\.pdf"/);
});

test("findability close matching is bounded at the token level", async () => {
  const html = await readFile(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const editDistanceSource = html.match(/function editDistance\(a,b\)\{[^\n]+\}/)?.[0];
  const closeMatchSource = html.match(/function isCloseMatch\(a,b\)\{[^\n]+\}/)?.[0];
  assert.ok(editDistanceSource && closeMatchSource);
  const closeMatch = Function(`${editDistanceSource};${closeMatchSource};return isCloseMatch`)();
  assert.equal(closeMatch("finderosityexpialidocious", "findability"), false);
  assert.equal(closeMatch("findabilty", "findability"), true);
  assert.equal(closeMatch("findablity", "findability"), true);
  assert.equal(closeMatch("metadata", "metadata"), true);
});

test("findability quotes are strict and unquoted terms use AND ranking", async () => {
  const html = await readFile(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const normalizeSource = html.match(/const normalizeText=[^\n]+/)?.[0];
  const editDistanceSource = html.match(/function editDistance\(a,b\)\{[^\n]+\}/)?.[0];
  const closeMatchSource = html.match(/function isCloseMatch\(a,b\)\{[^\n]+\}/)?.[0];
  const sequenceSource = html.match(/function hasExactTokenSequence\(tokens,keywords\)\{[^\n]+\}/)?.[0];
  const parseSource = html.match(/function parseSearchQuery\(query\)\{[^\n]+\}/)?.[0];
  const classifySource = html.match(/function classifyMatch\(text,keywords,exactPhrase\)\{[^\n]+\}/)?.[0];
  assert.ok(normalizeSource && editDistanceSource && closeMatchSource && sequenceSource && parseSource && classifySource);
  const searchLogic = Function(`${normalizeSource};${editDistanceSource};${closeMatchSource};${sequenceSource};${parseSource};${classifySource};return {parseSearchQuery,classifyMatch}`)();
  const quoted = searchLogic.parseSearchQuery('"diabetic foot"');
  assert.deepEqual(quoted, { exactPhrase: true, normalized: "diabetic foot", keywords: ["diabetic", "foot"] });
  assert.equal(searchLogic.classifyMatch("Diabetic Foot", quoted.keywords, true)?.kind, "Exact phrase");
  assert.equal(searchLogic.classifyMatch("Diabetic ulcer of the foot", quoted.keywords, true), null);
  assert.equal(searchLogic.classifyMatch("Diabetic ulcer of the foot", quoted.keywords, false)?.kind, "Exact keywords");
  assert.equal(searchLogic.classifyMatch("Findability of the foot", ["find", "foot"], false)?.kind, "Partial match");
  assert.equal(searchLogic.classifyMatch("Findability of the foot", ["findabilty", "foot"], false)?.kind, "Close match");
  assert.equal(searchLogic.classifyMatch("Diabetic metadata only", ["diabetic", "foot"], false), null);
});

test("KO replacement orders objects by workshop identifier metadata", async () => {
  const script = await readFile(new URL("../scripts/update-embedded-kos.mjs", import.meta.url), "utf8");
  assert.match(script, /schema:identifier\\s\+"workshop-ko-\(\\d\+\)"/);
  assert.match(script, /const an = workshopNumber\(root, a\.name\)/);
  assert.match(script, /const bn = workshopNumber\(root, b\.name\)/);
});

test("keeps published metadata, exercise kit, and simulation session as explicit models", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /type PublishedInteroperabilityModel =/);
  assert.match(source, /type InteroperabilityExerciseKit =/);
  assert.match(source, /type InteroperabilitySimulationSession =/);
  assert.match(source, /function publishedInteroperabilityModel\(/);
  assert.match(source, /function interoperabilityExerciseDiscovery\(/);
  assert.match(source, /type InteroperabilityExerciseDiscovery =/);
  assert.match(source, /Educational component unavailable/);
  assert.match(source, /const \[interoperabilitySessions, setInteroperabilitySessions\]/);
  assert.match(source, /const \[interoperabilityStagesObject, setInteroperabilityStagesObject\]/);
  assert.match(source, /className="interoperabilityGrid"/);
  assert.match(source, />Stages<\/button>/);
  assert.match(source, /Stages are not supplied for this knowledge object/);
  assert.match(source, /const projectedState = exercise \? projectInteroperabilityExerciseState/);
  assert.doesNotMatch(source, /const stage = projectedState\?\.primaryStage/);
  assert.match(source, /const nextFacet = projectedState\?\.nextPrimaryFacet/);
  assert.match(source, /const stateFor = \(state: number\)/);
  assert.match(source, /selectedState: state/);
  assert.doesNotMatch(source, /State comparison|Move freely among four interoperability states/);
  assert.match(source, /modeStateSelector/);
  assert.match(source, /\["Opaque", "Meaning", "Data Objects", "Interface"\]\.map/);
  assert.match(source, /detailSimulationOnly/);
  assert.doesNotMatch(source, /setInteroperabilityRepairs|setInteroperabilitySimulationStates/);
  assert.equal((source.match(/loadInteroperabilityExerciseKit\(/g) ?? []).length, 1, "the strict loader must be called only by the Interoperability View model adapter");
});

test("both editions use five interface process stages with outcomes handled by case controls", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const playback = await readFile(new URL("../app/interface-playback.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = await readFile(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const edition of [source, standalone]) {
    assert.match(edition, /Try Interface/);
    assert.match(edition, /Try Again/);
    assert.match(edition, /input-data-object/);
    assert.match(edition, /input-binding/);
    assert.match(edition, /output-data-object/);
  }
  assert.match(playback, /INTERFACE_PROCESS_STAGES = Object\.freeze\(\["input-data-object", "input-binding", "operation", "output-binding", "output-data-object"\]\)/);
  assert.doesNotMatch(source, /selectProps\(6\)/);
  assert.doesNotMatch(source, /className="interfaceOutcomeRail"/);
  assert.match(styles, /grid-template-columns: repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(styles, /interfaceOutcomeRail/);
  assert.match(source, /simulationCase\?\.failurePoint/);
  assert.match(source, /dispatchPlayback\(\{ type: "advance", step: frame\.step, runId \}\)/);
  assert.match(standalone, /reduceStandaloneInterfacePlayback/);
  assert.match(styles, /interfaceMotionRail/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(standalone, /interface-motion-rail/);
  assert.doesNotMatch(standalone, /interface-outcome-rail/);
  assert.match(standalone, /querySelector\('\[data-trace-role="outcome"\]'\)\?\.remove\(\)/);
  assert.match(standalone, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(standalone, /simulationCase\?\.failurePoint/);
  assert.match(standalone, /prefers-reduced-motion/);
});

function exerciseFixture(overrides = {}) {
  const root = "independent-exercise/";
  const target = { identifier: "example", version: "1.0", specification: "https://example.org/spec/1.0" };
  const content = {
    [`${root}interoperability.exercise.json`]: JSON.stringify({ exerciseType: "interoperability", knowledgeObject: "example", targetKnowledgeObject: target, simulationState: { semantics: "complete", profiles: "missing", interface: "complete" } }),
    [`${root}execution/raw-execution.json`]: JSON.stringify({ executionMode: "raw", publishedBoundary: false, entryPoint: "execution/raw.js#execute", executorBinding: "host-supplied", inputExample: "examples/raw-input.json", expectedOutput: "examples/raw-output.json" }),
    [`${root}execution/contract-execution.json`]: JSON.stringify({ executionMode: "contract", publishedBoundary: true, declaredInvocation: "await knowledgeObject.run(input)", entryPoint: "execution/contract.js#execute", targetBinding: { type: "externalKnowledgeObject", ...target }, input: { profile: "InputProfile", example: "examples/valid-input.json", profileArtifact: "profiles/input.json" }, output: { profile: "OutputProfile", example: "examples/expected-output.json", profileArtifact: "profiles/output.json" } }),
    [`${root}examples/raw-input.json`]: '{"input1":"opaque"}',
    [`${root}examples/raw-output.json`]: '{"output1":"opaque"}',
    [`${root}examples/valid-input.json`]: '{"value":1}',
    [`${root}examples/expected-output.json`]: '{"result":2}',
    [`${root}semantics/input-semantics.json`]: JSON.stringify({ artifactType: "semantic-boundary-view", role: "input", concept: "Input", identifier: "https://example.org/Input", meaning: "Example input" }),
    [`${root}semantics/output-semantics.json`]: JSON.stringify({ artifactType: "semantic-boundary-view", role: "output", concept: "Output", identifier: "https://example.org/Output", meaning: "Example output" }),
    [`${root}profiles/input.json`]: JSON.stringify({ artifactType: "object-profile", profile: "InputProfile", semanticType: "Input", type: "object", required: ["value"], properties: { value: { type: "number" } }, example: { value: 1 } }),
    [`${root}profiles/output.json`]: JSON.stringify({ artifactType: "object-profile", profile: "OutputProfile", semanticType: "Output", type: "object", required: ["result"], properties: { result: { type: "number" } }, example: { result: 2 } }),
    [`${root}interface/interface.json`]: JSON.stringify({ artifactType: "interface-boundary-view", targetKnowledgeObject: "example", invocation: { language: "JavaScript", member: "run", signature: "run(input)", usage: "await knowledgeObject.run(input)" }, inputBinding: "InputProfile", outputBinding: "OutputProfile" }),
    [`${root}states/missing-all.json`]: JSON.stringify({ semantics: "missing", profiles: "missing", interface: "missing" }),
    ...overrides,
  };
  return { files: Object.keys(content), readText: (path) => content[path], content, root, target };
}

test("strict interoperability exercise loader is pure, root-scoped, and validates facet states", () => {
  assert.deepEqual(loadInteroperabilityExerciseKit({ files: ["metadata.json"], readText: () => "{}" }), { status: "absent" });
  const fixture = exerciseFixture();
  const loaded = loadInteroperabilityExerciseKit(fixture);
  assert.equal(loaded.status, "valid");
  assert.equal(loaded.root, fixture.root);
  assert.deepEqual(loaded.state, { semantics: "complete", profiles: "missing", interface: "complete" });
  assert.deepEqual(loaded.execution.rawInput.data, { input1: "opaque" });
  assert.deepEqual(loaded.execution.contractOutput.data, { result: 2 });
  assert.equal(loaded.artifacts.semantics.input.data.role, "input");
  assert.equal(loaded.artifacts.profiles.output.data.profile, "OutputProfile");
  assert.equal(loaded.artifacts.interface.data.invocation.signature, "run(input)");

  const invalidState = exerciseFixture({ [`${fixture.root}interoperability.exercise.json`]: JSON.stringify({ exerciseType: "interoperability", knowledgeObject: fixture.target.identifier, targetKnowledgeObject: fixture.target, simulationState: { semantics: "unknown", profiles: "missing", interface: "complete" } }) });
  const invalidStateResult = loadInteroperabilityExerciseKit(invalidState);
  assert.equal(invalidStateResult.status, "invalid");
  assert.match(invalidStateResult.diagnostics[0], /semantics must be "complete" or "missing"/);

  const traversal = exerciseFixture({ [`${fixture.root}execution/raw-execution.json`]: JSON.stringify({ executionMode: "raw", publishedBoundary: false, entryPoint: "execution/raw.js#execute", executorBinding: "host-supplied", inputExample: "../secret.json", expectedOutput: "examples/raw-output.json" }), "secret.json": "{}" });
  const traversalResult = loadInteroperabilityExerciseKit(traversal);
  assert.equal(traversalResult.status, "invalid");
  assert.match(traversalResult.diagnostics[0], /escapes the exercise root/);
});

test("interoperability exercise artifacts are parsed into strict typed models", () => {
  const fixture = exerciseFixture();
  const wrongSemanticRole = exerciseFixture({ [`${fixture.root}semantics/input-semantics.json`]: JSON.stringify({ artifactType: "semantic-boundary-view", role: "output", concept: "Input", identifier: "https://example.org/Input", meaning: "Wrong role" }) });
  const semanticResult = loadInteroperabilityExerciseKit(wrongSemanticRole);
  assert.equal(semanticResult.status, "invalid");
  assert.match(semanticResult.diagnostics[0], /role must be "input"/);

  const missingProfileProperty = exerciseFixture({ [`${fixture.root}profiles/input.json`]: JSON.stringify({ artifactType: "object-profile", profile: "InputProfile", semanticType: "Input", type: "object", required: ["missing"], properties: {}, example: {} }) });
  const profileResult = loadInteroperabilityExerciseKit(missingProfileProperty);
  assert.equal(profileResult.status, "invalid");
  assert.match(profileResult.diagnostics[0], /missing required property definition/);

  const inconsistentBinding = exerciseFixture({ [`${fixture.root}interface/interface.json`]: JSON.stringify({ artifactType: "interface-boundary-view", targetKnowledgeObject: "example", invocation: { language: "JavaScript", member: "run", signature: "run(input)", usage: "await knowledgeObject.run(input)" }, inputBinding: "WrongProfile", outputBinding: "OutputProfile" }) });
  const bindingResult = loadInteroperabilityExerciseKit(inconsistentBinding);
  assert.equal(bindingResult.status, "invalid");
  assert.match(bindingResult.diagnostics[0], /Input profile bindings are inconsistent/);
});

test("interoperability exercise target mismatch disables only the educational kit", () => {
  const identifierMismatch = exerciseFixture();
  const identifierResult = loadInteroperabilityExerciseKit({ ...identifierMismatch, target: { ...identifierMismatch.target, identifier: "another-ko" } });
  assert.equal(identifierResult.status, "invalid");
  assert.match(identifierResult.diagnostics[0], /identifier does not match/);

  const versionMismatch = exerciseFixture();
  const versionResult = loadInteroperabilityExerciseKit({ ...versionMismatch, target: { ...versionMismatch.target, version: "2.0" } });
  assert.equal(versionResult.status, "invalid");
  assert.match(versionResult.diagnostics[0], /version does not match/);

  const specificationMismatch = exerciseFixture();
  const specificationResult = loadInteroperabilityExerciseKit({ ...specificationMismatch, target: { ...specificationMismatch.target, specification: "https://example.org/spec/other" } });
  assert.equal(specificationResult.status, "invalid");
  assert.match(specificationResult.diagnostics[0], /specification does not match/);
});

test("all eight interoperability facet combinations project independently", () => {
  const values = ["missing", "complete"];
  for (const semantics of values) for (const profiles of values) for (const interfac of values) {
    const projection = projectInteroperabilityExerciseState({ semantics, profiles, interface: interfac });
    assert.equal(projection.visible.semantics, semantics === "complete");
    assert.equal(projection.visible.profiles, profiles === "complete");
    assert.equal(projection.visible.interface, interfac === "complete");
    assert.equal(projection.rawExecutionAvailable, true);
    assert.equal(projection.contractExecutionAvailable, interfac === "complete");
    assert.equal(projection.complete, semantics === "complete" && profiles === "complete" && interfac === "complete");
  }
});

test("host-supplied interoperability simulation binding remains implementation-free", () => {
  const host = createInteroperabilitySimulationHost();
  const target = { identifier: "example", version: "1.0", specification: "https://example.org/spec/1.0" };
  const missing = host.simulate({ target, mode: "raw", input: { input1: "x" }, expectedOutput: { output1: "y" }, manifest: { executionMode: "raw" } });
  assert.equal(missing.status, "binding-unavailable");
  host.registerBinding(target, fixtureReplaySimulationBinding);
  assert.equal(host.hasBinding(target), true);
  const completed = host.simulate({ target, mode: "contract", input: { value: 1 }, expectedOutput: { result: 2 }, manifest: { executionMode: "contract" } });
  assert.deepEqual(completed, { status: "completed", mode: "contract", output: { result: 2 }, binding: "host-supplied-simulation", implementationInvoked: false });
  host.registerBinding(target, () => { throw new Error("teaching binding failed"); });
  const failed = host.simulate({ target, mode: "raw", input: {}, expectedOutput: {}, manifest: {} });
  assert.equal(failed.status, "failed");
  assert.match(failed.message, /teaching binding failed/);
  assert.equal(failed.implementationInvoked, false);
});

test("KO access API prepares deterministic embedded and working ZIP representations", async () => {
  const objects = [{ id: "wagner", name: "Wagner", sourceIndex: 5, aliases: [5, "Knowledge Object 5"] }];
  const embedded = [{ path: "metadata.json", content: "embedded" }, { path: "src/index.js", content: "run();" }];
  const working = [{ path: "metadata.json", content: "edited" }, { path: "src/index.js", content: "run();" }];
  const api = createKnowledgeObjectAccessApi({ objects, getEmbeddedFiles: () => embedded, getWorkingFiles: () => working, environment: globalThis });
  assert.deepEqual(api.listKnowledgeObjects(), [{ id: "wagner", name: "Wagner" }]);

  const missingPassword = await api.prepareKnowledgeObjectZip({ knowledgeObjectId: "wagner" });
  assert.equal(missingPassword.ok, false);
  assert.equal(missingPassword.status, "authentication-required");
  const wrongCase = await api.prepareKnowledgeObjectZip({ knowledgeObjectId: "wagner", password: "texas" });
  assert.equal(wrongCase.ok, false);
  assert.equal(wrongCase.status, "authentication-failed");

  const first = await api.prepareKnowledgeObjectZip({ knowledgeObjectId: "wagner", password: "Texas" });
  const second = await api.prepareKnowledgeObjectZip({ knowledgeObjectId: 5, content: "embedded", format: "zip", password: "Texas" });
  assert.equal(first.ok, true);
  assert.equal(first.status, "prepared");
  assert.equal(first.fileName, "wagner.zip");
  assert.equal(first.mediaType, "application/zip");
  assert.equal(first.fileCount, 2);
  assert.equal(first.sha256, second.sha256);
  const firstBytes = new Uint8Array(await first.blob.arrayBuffer());
  assert.deepEqual([...firstBytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const archiveText = new TextDecoder().decode(firstBytes);
  assert.match(archiveText, /wagner\/metadata\.json/);
  assert.match(archiveText, /wagner\/src\/index\.js/);
  assert.match(archiveText, /embedded/);

  const copiedPreparation = await api.savePreparedDownload({ ...first });
  assert.equal(copiedPreparation.ok, false);
  assert.equal(copiedPreparation.status, "invalid-prepared-download");

  const edited = await api.prepareKnowledgeObjectZip({ knowledgeObjectId: "Wagner", content: "working", password: "Texas" });
  assert.equal(edited.fileName, "wagner-working-copy.zip");
  assert.match(new TextDecoder().decode(await edited.blob.arrayBuffer()), /edited/);

  const missing = await api.prepareKnowledgeObjectZip({ knowledgeObjectId: "missing", password: "Texas" });
  assert.deepEqual(missing, {
    ok: false,
    knowledgeObjectId: "missing",
    status: "knowledge-object-not-found",
    message: "No embedded knowledge object has the identifier 'missing'.",
  });
});
