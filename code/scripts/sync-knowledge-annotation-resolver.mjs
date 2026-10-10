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
const passageBlock = `${passageStart}\nconst { evidenceActionUrl, markVerifiedPassage } = (() => {\n${passageSource}\nreturn { evidenceActionUrl, markVerifiedPassage };\n})();\n${passageEnd}\n`;
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
if (!html.includes(replacement) && !html.includes("annotationResolution:{...annotationResolution")) {
  if (!html.includes(field)) throw new Error("Standalone K-model projection insertion point not found");
  html = html.replace(field, replacement);
}
const linkingHelper = 'function renderKnowledgeLinkingDetail(model){const nexus=evidenceNexusIndicator(model.linkingCategory.category);return`<span class="knowledge-nexus-label nexus-level-${nexus.level}" title="${escapeHtml(nexus.explanation)}" tabindex="0" aria-label="${escapeHtml(`${nexus.label}: ${nexus.explanation}`)}">${escapeHtml(nexus.label)}</span>`}\n';
if (html.includes("function renderKnowledgeLinkingDetail(model)")) {
  html = html.replace(/function renderKnowledgeLinkingDetail\(model\)[^\n]*\n/, linkingHelper);
} else {
  html = html.replace("function renderKnowledge(){", linkingHelper + "function renderKnowledge(){");
}
const relationshipHelper = `function renderKnowledgeRelationshipMap(model){
  const map=buildKnowledgeRelationshipMap(model);
  const sources=(items)=>items.map((item)=>'<span class="knowledgeMapSource">'+escapeHtml(item.name)+'</span>').join('');
  const passages=(items,kind)=>items.map((item)=>'<span class="knowledgeMapPassage">Knowledge element → '+kind+': '+escapeHtml(item.title)+(item.status!=="resolved"?'<em> · Unresolved</em>':'')+'</span>').join('');
  let content='<div class="knowledgeMapHeading"><small>Evidence linking</small><strong>'+escapeHtml(map.descriptor)+'</strong></div>';
  if(map.wholeKoSources.length)content+='<div class="knowledgeMapBranch"><div class="knowledgeMapEvidence"><small>Declared evidential basis</small>'+sources(map.wholeKoSources)+'</div><span class="knowledgeMapArrow" aria-hidden="true">→</span><div class="knowledgeMapElement"><small>Declaration site</small><strong>Whole KO</strong></div><p class="knowledgeMapNote">These sources are not assigned to individual knowledge elements.</p></div>';
  for(const branch of map.branches){content+='<div class="knowledgeMapBranch"><div class="knowledgeMapEvidence"><small>Declared evidential basis</small>'+(branch.evidence.length?sources(branch.evidence):'<span class="knowledgeMapMissing">No declared evidential basis</span>')+'</div><span class="knowledgeMapArrow" aria-hidden="true">'+(branch.evidence.length?'→':'')+'</span><div class="knowledgeMapElement"><small>Knowledge element</small><strong>'+escapeHtml(branch.elementName)+'</strong></div>';
    if(branch.specificationPassages.length||branch.implementationPassages.length)content+='<div class="knowledgeMapPassages"><small>Separately linked from this element</small>'+passages(branch.specificationPassages,'CKS passage')+passages(branch.implementationPassages,'Code passage')+'</div>';
    content+='</div>';
  }
  if(!map.wholeKoSources.length&&!map.branches.length)content+='<p class="knowledgeMapNone">No direct evidential basis declared for this '+(model.dependencyCount!==null?'assembly':'KO')+'.'+(model.dependencyCount!==null?' Constituent KO evidence is not inherited.':'')+'</p>';
  if(map.branches.some((branch)=>branch.implementationPassages.length))content+='<p class="knowledgeMapNote">A code-passage link identifies an element’s implementation; it is not a direct evidence-to-code assertion.</p>';
  return '<section class="knowledgeRelationshipMap" aria-label="Evidence linking relationship map">'+content+'</section>';
}\n`;
if (!html.includes("function renderKnowledgeRelationshipMap(model)")) {
  html = html.replace("function renderKnowledge(){", relationshipHelper + "function renderKnowledge(){");
}
html = html.replaceAll("'<span class=\"knowledgeMapPassage\">'+kind+': '", "'<span class=\"knowledgeMapPassage\">Knowledge element → '+kind+': '");
const mapMount = '</span></summary><div class="facet-list knowledge-card-body">';
const mapMounted = '</span></summary>${renderKnowledgeRelationshipMap(model)}<div class="facet-list knowledge-card-body">';
if (!html.includes(mapMounted)) {
  if (!html.includes(mapMount)) throw new Error("Standalone K relationship-map mount not found");
  html = html.replace(mapMount, mapMounted);
}
const summaryBefore = '<summary><strong>${escapeHtml(objectName(objectId))}</strong><span class="knowledge-facet-count';
const summaryAfter = '<summary><strong>${escapeHtml(objectName(objectId))}</strong>${renderKnowledgeLinkingDetail(model)}<span class="knowledge-facet-count';
const compactSummary = '<summary><strong>${escapeHtml(objectName(objectId))}</strong><span class="knowledge-tab-indicators">${renderKnowledgeLinkingDetail(model)}<span class="knowledge-facet-count';
if (!html.includes(summaryAfter) && !html.includes(compactSummary)) {
  if (!html.includes(summaryBefore)) throw new Error("Standalone K summary insertion point not found");
  html = html.replace(summaryBefore, summaryAfter);
}
if (!html.includes(compactSummary)) {
  if (!html.includes(summaryAfter)) throw new Error("Standalone K compact-summary insertion point not found");
  html = html.replace(summaryAfter, compactSummary);
  html = html.replace('</span></summary>${renderKnowledgeRelationshipMap(model)}', '</span></span></summary>${renderKnowledgeRelationshipMap(model)}');
}
writeFileSync(path, html);
