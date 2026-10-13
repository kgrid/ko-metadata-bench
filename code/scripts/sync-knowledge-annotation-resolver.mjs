import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "app/knowledge-annotation-resolver.js"), "utf8")
  .replace("export function resolveKnowledgeAnnotations", "function resolveKnowledgeAnnotations");
const categorySource = readFileSync(join(root, "app/evidence-linking-category.js"), "utf8")
  .replace("export const EVIDENCE_LINKING_CATEGORIES", "const EVIDENCE_LINKING_CATEGORIES")
  .replace("export const EVIDENCE_NEXUS_INDICATORS", "const EVIDENCE_NEXUS_INDICATORS")
  .replace("export function evidenceNexusIndicator", "function evidenceNexusIndicator")
  .replace("export function deriveEvidenceLinkingCategory", "function deriveEvidenceLinkingCategory");
const relationshipSource = readFileSync(join(root, "app/knowledge-relationship-map.js"), "utf8")
  .replace("export function buildKnowledgeRelationshipMap", "function buildKnowledgeRelationshipMap");
const subgraphContractSource = readFileSync(join(root, "app/evidence-subgraph-contract.js"), "utf8")
  .replaceAll("export const ", "const ")
  .replace("export function permitsEvidenceSubgraphRelationship", "function permitsEvidenceSubgraphRelationship");
const subgraphProjectionSource = readFileSync(join(root, "app/evidence-subgraph-projection.js"), "utf8")
  .replace(/^import .*\n/gm, "")
  .replace("export function projectEvidenceSubgraph", "function projectEvidenceSubgraph");
const subgraphLayoutSource = readFileSync(join(root, "app/evidence-subgraph-layout.js"), "utf8")
  .replaceAll("export function ", "function ");
const subgraphInspectorSource = readFileSync(join(root, "app/evidence-subgraph-inspector.js"), "utf8")
  .replace("export function inspectEvidenceSubgraphNode", "function inspectEvidenceSubgraphNode")
  .replace("export function inspectEvidenceSubgraphRelationship", "function inspectEvidenceSubgraphRelationship");
const subgraphActionsSource = readFileSync(join(root, "app/evidence-subgraph-actions.js"), "utf8")
  .replace(/^import .*\n/gm, "")
  .replace("export function planEvidenceSubgraphActions", "function planEvidenceSubgraphActions");
const passageGlimpseSource = readFileSync(join(root, "app/evidence-passage-glimpse.js"), "utf8")
  .replace("export function evidencePassageGlimpse", "function evidencePassageGlimpse");
const subgraphViewRecordSource = readFileSync(join(root, "app/evidence-subgraph-view-record.js"), "utf8")
  .replace(/^import .*\n/gm, "")
  .replace("export function buildEvidenceSubgraphViewRecord", "function buildEvidenceSubgraphViewRecord");
const passageSource = readFileSync(join(root, "app/passage-navigation.js"), "utf8")
  .replace("export function safeEvidenceUrl", "function safeEvidenceUrl")
  .replace("export function evidenceActionUrl", "function evidenceActionUrl")
  .replace("export function markVerifiedPassage", "function markVerifiedPassage");
const path = join(root, "outputs/Knowledge-Object-Workbench.html");
let html = readFileSync(path, "utf8");
const startMarker = "/* KNOWLEDGE_ANNOTATION_RESOLVER_START */";
const endMarker = "/* KNOWLEDGE_ANNOTATION_RESOLVER_END */";
const block = `${startMarker}\nconst resolveKnowledgeAnnotations = (() => {\n${source}\nreturn resolveKnowledgeAnnotations;\n})();\n${endMarker}\n`;
if (html.includes(startMarker)) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start) + endMarker.length;
  html = html.slice(0, start) + block.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone K-model insertion point not found");
  html = html.replace(anchor, block + anchor);
}
const categoryStart = "/* EVIDENCE_LINKING_CATEGORY_START */";
const categoryEnd = "/* EVIDENCE_LINKING_CATEGORY_END */";
const categoryBlock = `${categoryStart}\nconst { deriveEvidenceLinkingCategory, evidenceNexusIndicator } = (() => {\n${categorySource}\nreturn { deriveEvidenceLinkingCategory, evidenceNexusIndicator };\n})();\n${categoryEnd}\n`;
if (html.includes(categoryStart)) {
  const start = html.indexOf(categoryStart);
  const end = html.indexOf(categoryEnd, start) + categoryEnd.length;
  html = html.slice(0, start) + categoryBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone category insertion point not found");
  html = html.replace(anchor, categoryBlock + anchor);
}
const subgraphContractStart = "/* EVIDENCE_SUBGRAPH_CONTRACT_START */";
const subgraphContractEnd = "/* EVIDENCE_SUBGRAPH_CONTRACT_END */";
const subgraphContractBlock = `${subgraphContractStart}\n${subgraphContractSource}\n${subgraphContractEnd}\n`;
if (html.includes(subgraphContractStart)) {
  const start = html.indexOf(subgraphContractStart);
  const end = html.indexOf(subgraphContractEnd, start) + subgraphContractEnd.length;
  html = html.slice(0, start) + subgraphContractBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone evidence-subgraph contract insertion point not found");
  html = html.replace(anchor, subgraphContractBlock + anchor);
}
const subgraphProjectionStart = "/* EVIDENCE_SUBGRAPH_PROJECTION_START */";
const subgraphProjectionEnd = "/* EVIDENCE_SUBGRAPH_PROJECTION_END */";
const subgraphProjectionBlock = `${subgraphProjectionStart}\nconst projectEvidenceSubgraph = (() => {\nconst N = EVIDENCE_SUBGRAPH_NODE_KINDS, R = EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS;\n${subgraphProjectionSource}\nreturn projectEvidenceSubgraph;\n})();\n${subgraphProjectionEnd}\n`;
if (html.includes(subgraphProjectionStart)) {
  const start = html.indexOf(subgraphProjectionStart);
  const end = html.indexOf(subgraphProjectionEnd, start) + subgraphProjectionEnd.length;
  html = html.slice(0, start) + subgraphProjectionBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone evidence-subgraph projection insertion point not found");
  html = html.replace(anchor, subgraphProjectionBlock + anchor);
}
const layoutStart = "/* EVIDENCE_SUBGRAPH_LAYOUT_START */";
const layoutEnd = "/* EVIDENCE_SUBGRAPH_LAYOUT_END */";
const layoutBlock = `${layoutStart}\n${subgraphLayoutSource}\n${layoutEnd}\n`;
if (html.includes(layoutStart)) {
  const start = html.indexOf(layoutStart);
  const end = html.indexOf(layoutEnd, start) + layoutEnd.length;
  html = html.slice(0, start) + layoutBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone evidence-subgraph layout insertion point not found");
  html = html.replace(anchor, layoutBlock + anchor);
}
const glimpseStart = "/* EVIDENCE_PASSAGE_GLIMPSE_START */";
const actionsStart = "/* EVIDENCE_SUBGRAPH_ACTIONS_START */";
const actionsEnd = "/* EVIDENCE_SUBGRAPH_ACTIONS_END */";
const actionsBlock = `${actionsStart}\n${subgraphActionsSource}\n${actionsEnd}\n`;
if (html.includes(actionsStart)) {
  const start = html.indexOf(actionsStart);
  const end = html.indexOf(actionsEnd, start) + actionsEnd.length;
  html = html.slice(0, start) + actionsBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone evidence-subgraph actions insertion point not found");
  html = html.replace(anchor, actionsBlock + anchor);
}
const inspectorStart = "/* EVIDENCE_SUBGRAPH_INSPECTOR_START */";
const inspectorEnd = "/* EVIDENCE_SUBGRAPH_INSPECTOR_END */";
const inspectorBlock = `${inspectorStart}\n${subgraphInspectorSource}\n${inspectorEnd}\n`;
if (html.includes(inspectorStart)) {
  const start = html.indexOf(inspectorStart);
  const end = html.indexOf(inspectorEnd, start) + inspectorEnd.length;
  html = html.slice(0, start) + inspectorBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone evidence-subgraph inspector insertion point not found");
  html = html.replace(anchor, inspectorBlock + anchor);
}
const glimpseEnd = "/* EVIDENCE_PASSAGE_GLIMPSE_END */";
const glimpseBlock = `${glimpseStart}\n${passageGlimpseSource}\n${glimpseEnd}\n`;
if (html.includes(glimpseStart)) {
  const start = html.indexOf(glimpseStart);
  const end = html.indexOf(glimpseEnd, start) + glimpseEnd.length;
  html = html.slice(0, start) + glimpseBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone passage-glimpse insertion point not found");
  html = html.replace(anchor, glimpseBlock + anchor);
}
const viewRecordStart = "/* EVIDENCE_SUBGRAPH_VIEW_RECORD_START */";
const viewRecordEnd = "/* EVIDENCE_SUBGRAPH_VIEW_RECORD_END */";
const viewRecordBlock = `${viewRecordStart}\n${subgraphViewRecordSource}\n${viewRecordEnd}\n`;
if (html.includes(viewRecordStart)) {
  const start = html.indexOf(viewRecordStart);
  const end = html.indexOf(viewRecordEnd, start) + viewRecordEnd.length;
  html = html.slice(0, start) + viewRecordBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone evidence-subgraph view-record insertion point not found");
  html = html.replace(anchor, viewRecordBlock + anchor);
}
const standaloneResolution = 'const annotationResolution=resolveKnowledgeAnnotations(metadata);';
const standaloneResolved = 'const annotationResolution=resolveKnowledgeAnnotations(metadata),resolvedAnnotations={...annotationResolution,annotations:annotationResolution.annotations.map(annotation=>({...annotation,destination:destinationStatuses.find(status=>status.annotationId===annotation.id&&status.targetId===annotation.targetId)??{status:"not-checked",reason:"Passage has not been checked against embedded content"}}))};';
if (!html.includes(standaloneResolved)) {
  if (!html.includes(standaloneResolution)) throw new Error("Standalone annotation resolution insertion point not found");
  html = html.replace(standaloneResolution, standaloneResolved);
}
const standaloneInlineResolution = 'annotationResolution:{...annotationResolution,annotations:annotationResolution.annotations.map(annotation=>({...annotation,destination:destinationStatuses.find(status=>status.annotationId===annotation.id&&status.targetId===annotation.targetId)??{status:"not-checked",reason:"Passage has not been checked against embedded content"}}))}';
if (html.includes(standaloneInlineResolution)) html = html.replace(standaloneInlineResolution, 'annotationResolution:resolvedAnnotations,evidenceSubgraph:projectEvidenceSubgraph(metadata,model,resolvedAnnotations)');
else if (!html.includes('evidenceSubgraph:projectEvidenceSubgraph(metadata,model,resolvedAnnotations)')) throw new Error("Standalone evidence-subgraph model mount not found");
const relationshipStart = "/* KNOWLEDGE_RELATIONSHIP_MAP_START */";
const relationshipEnd = "/* KNOWLEDGE_RELATIONSHIP_MAP_END */";
const relationshipBlock = `${relationshipStart}\nconst buildKnowledgeRelationshipMap = (() => {\n${relationshipSource}\nreturn buildKnowledgeRelationshipMap;\n})();\n${relationshipEnd}\n`;
if (html.includes(relationshipStart)) {
  const start = html.indexOf(relationshipStart);
  const end = html.indexOf(relationshipEnd, start) + relationshipEnd.length;
  html = html.slice(0, start) + relationshipBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone relationship-map insertion point not found");
  html = html.replace(anchor, relationshipBlock + anchor);
}
const passageStart = "/* KNOWLEDGE_PASSAGE_NAVIGATION_START */";
const passageEnd = "/* KNOWLEDGE_PASSAGE_NAVIGATION_END */";
const passageBlock = `${passageStart}\nconst { evidenceActionUrl, markVerifiedPassage, safeEvidenceUrl } = (() => {\n${passageSource}\nreturn { evidenceActionUrl, markVerifiedPassage, safeEvidenceUrl };\n})();\n${passageEnd}\n`;
if (html.includes(passageStart)) {
  const start = html.indexOf(passageStart);
  const end = html.indexOf(passageEnd, start) + passageEnd.length;
  html = html.slice(0, start) + passageBlock.trimEnd() + html.slice(end);
} else {
  const anchor = "function buildKnowledgeViewModel(metadata)";
  if (!html.includes(anchor)) throw new Error("Standalone passage-navigation insertion point not found");
  html = html.replace(anchor, passageBlock + anchor);
}
const field = "dependencyCount,cks:cks?";
const replacement = "dependencyCount,annotationResolution:resolveKnowledgeAnnotations(metadata),cks:cks?";
if (!html.includes(replacement) && !html.includes("annotationResolution:{...annotationResolution") && !html.includes("annotationResolution:resolvedAnnotations")) {
  if (!html.includes(field)) throw new Error("Standalone K-model projection insertion point not found");
  html = html.replace(field, replacement);
}
const linkingHelper = 'function renderKnowledgeLinkingDetail(model){const nexus=evidenceNexusIndicator(model.linkingCategory.category);return`<span class="knowledge-nexus-label nexus-level-${nexus.level}" title="${escapeHtml(nexus.explanation)}" tabindex="0" aria-label="${escapeHtml(`${nexus.label}: ${nexus.explanation}`)}">${escapeHtml(nexus.label)}</span>`}\n';
if (html.includes("function renderKnowledgeLinkingDetail(model)")) {
  html = html.replace(/function renderKnowledgeLinkingDetail\(model\)[^\n]*\n/, linkingHelper);
} else {
  html = html.replace("function renderKnowledge(){", linkingHelper + "function renderKnowledge(){");
}
html = html.replace(/function renderKnowledgeRelationshipMap\(model\)\{[\s\S]*?\n\}\n(?=function renderKnowledge\(\))/, "");
html = html.replace('${renderKnowledgeRelationshipMap(model)}', "");
const summaryBefore = '<summary><strong>${escapeHtml(objectName(objectId))}</strong><span class="knowledge-facet-count';
const summaryAfter = '<summary><strong>${escapeHtml(objectName(objectId))}</strong>${renderKnowledgeLinkingDetail(model)}<span class="knowledge-facet-count';
const compactSummary = '<summary><strong>${escapeHtml(objectName(objectId))}</strong><span class="knowledge-tab-indicators">${renderKnowledgeLinkingDetail(model)}<span class="knowledge-facet-count';
if (!html.includes(summaryAfter) && !html.includes(compactSummary) && !html.includes('data-knowledge-explore="${objectId}"')) {
  if (!html.includes(summaryBefore)) throw new Error("Standalone K summary insertion point not found");
  html = html.replace(summaryBefore, summaryAfter);
}
if (!html.includes(compactSummary) && !html.includes('data-knowledge-explore="${objectId}"')) {
  if (!html.includes(summaryAfter)) throw new Error("Standalone K compact-summary insertion point not found");
  html = html.replace(summaryAfter, compactSummary);
  html = html.replace('</span></summary><div class="facet-list knowledge-card-body">', '</span></span></summary><div class="facet-list knowledge-card-body">');
}
// One tab-level entry opens the complete KO-scoped subgraph; facet rows remain summaries.
html = html.replace(/<button class="knowledgeOpenButton"[^>]*>Explore<\/button>/g, "");
if (!html.includes('data-knowledge-explore="${objectId}"')) {
  const indicator = '${renderKnowledgeLinkingDetail(model)}';
  if (!html.includes(indicator)) throw new Error("Standalone K tab Explore insertion point not found");
  html = html.replace(indicator, '<button class="knowledgeOpenButton knowledge-tab-explore" type="button" data-knowledge-explore="${objectId}" aria-label="Explore ${escapeHtml(objectName(objectId))}">Explore</button>' + indicator);
}
const openKnowledgeHandler = 'function openKnowledge(){workspace.innerHTML=renderKnowledge();workspace.querySelectorAll("[data-knowledge-explore]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openKnowledgeSubgraphStandalone(Number(button.dataset.knowledgeExplore))}))}';
if (!html.includes(openKnowledgeHandler)) {
  const previousHandler = /function openKnowledge\(\)\{[^\n]*\}\n(?=function renderAccessibilityCard)/;
  if (!previousHandler.test(html)) throw new Error("Standalone K Explore handler insertion point not found");
  html = html.replace(previousHandler, `${openKnowledgeHandler}\n`);
}
// The graph already distinguishes file context from verified passage targets.
html = html.replace('<p class="knowledgeFollowIntro">Only relationships declared in this Knowledge Object’s metadata are shown. File-level context is not a passage link.</p>', "");
// Both linked sources and their parent publications are evidence-resource nodes.
const incorrectBasisNodeLabel = 'node(basis.resource,"evidential basis")';
if (!html.includes(incorrectBasisNodeLabel) && !html.includes('node(basis.resource,"evidence resource")')) {
  throw new Error("Standalone evidence-resource node label not found");
}
html = html.replaceAll(incorrectBasisNodeLabel, 'node(basis.resource,"evidence resource")');
const fourColumnRows = readFileSync(join(root, "scripts/standalone-evidence-graph-rows.txt"), "utf8").trimEnd();
html = html.replace(/  const render(?:Graph)?Route=route=>[^\n]*\n/g, "");
html = html.replace(/  const renderGraphFile=\(file,kind\)=>[^\n]*\n/g, "");
const rowsPattern = /  const rows=lanes\.map\(lane=>[^\n]*\n(?=  (?:let selectedTrigger=null;\n  )?const dialog=)/;
if (!rowsPattern.test(html)) throw new Error("Standalone evidence graph row insertion point not found");
html = html.replace(rowsPattern, `${fourColumnRows}\n`);
const oldGraphHead = '<div class="knowledgeGraphHead"><span>Evidence</span><span>Declaring subject</span><span>Declared targets</span></div>';
const fourColumnHead = '<div class="knowledgeGraphHead"><span>Evidence</span><span>Declaring subject</span><span>Specification passages</span><span>Implementation passages</span></div>';
if (!html.includes(oldGraphHead) && !html.includes(fourColumnHead)) throw new Error("Standalone evidence graph heading not found");
html = html.replace(oldGraphHead, fourColumnHead);
writeFileSync(path, html);
