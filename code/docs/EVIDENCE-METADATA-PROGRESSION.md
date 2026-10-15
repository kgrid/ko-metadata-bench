# Evidence metadata progression

This document records the intended five-level teaching progression for evidence relationships in the four Knowledge Objects and one Knowledge Assembly. It guides how the SWA presents metadata placement and specificity in this workshop collection. The agreed category sequence is **None → KO-wide → Element + specification → Elements + code → Element + specification + code**. These are categories of linking detail, not ratings of clinical quality, computational correctness, trustworthiness, or evidence quality. A link must express only a relationship supported by the object and its sources; a higher level must not be achieved by inventing one.

| Level | Object | Linking-detail category | Learner-facing descriptor | Intended evidence-linking pattern |
| --- | --- | --- | --- | --- |
| 1 | HBOT Treatment Target Knowledge Assembly | None | No direct evidence links | No KA-owned evidential basis is declared. Its constituent Knowledge Objects and their evidence remain separately identified; their evidence is not inherited as KA-owned evidence. |
| 2 | DFU Severity Score KO | KO-wide | Evidence → whole KO | Evidence is linked to the KO as a whole. The metadata does not assign a source to either individual knowledge element. |
| 3 | HBOT Treatment Decision KO | Element + specification | Evidence → knowledge element → CKS passage | Evidence is linked to its one knowledge element, with the guideline's Figure 6 decision model identified specifically and a separately verified link from that element to the relevant CKS content. The JavaScript implementation remains linked at file level, without a code-passage annotation. |
| 4 | HBOT Regimen Burden KO | Elements + code | Evidence → knowledge elements → corresponding code passages | Evidence relationships are distributed across multiple knowledge elements. Regimen Range has two sources; Burden Questionnaire Logic has the facility-list source; Burden Response Analysis has no separately declared evidential basis. Each element has a content-anchored Web Annotation to a passage in its own implementation file; no CKS passage is annotated. The arrow describes a route through the elements, not a direct evidence-to-code assertion or evidence for every element. |
| 5 | DFU Prognostic Indicator KO | Element + specification + code | Evidence → knowledge element → CKS passage + code passages | The knowledge element links to the specific supplementary Table 3 evidence resource, a content-anchored CKS decision table, and two content-anchored implementation passages. The CKS's threshold-equality decision remains distinct from the published evidence. |

Levels 3 and 4 teach different forms of specificity: a published decision model and CKS passage for one element versus evidence placement across several elements and a code-passage link for each. Level 5 joins evidence, CKS, and implementation passages around one element. This is an instructional sequence, not a claim that one form is universally more precise than another.

## SWA display classification rules

The K view derives its linking-detail category from each object's own `metadata.json`, never its name, workshop position, or assumed clinical quality. A declared evidential basis counts only at its declaration site: KO-level `koio:hasEvidentialBasis` is KO-wide; a knowledge element's basis belongs only to that element. `dc:source`, general documentation, and file-level `implementedBy` do not create evidence or passage links. Constituent-KO references do not transfer their evidence to a KA.

For passage detail, the element must have a `schema:subjectOf` Web Annotation whose body is that element and whose target identifies a `schema:hasPart` `oa:SpecificResource` with a `oa:TextQuoteSelector` on either a specification document or that element's implementation file. A source citation or an unconnected annotation is insufficient.

| Display category | Required declared pattern |
| --- | --- |
| None | Own knowledge is declared, but neither the object nor its own elements declare a direct evidential basis. |
| KO-wide | The object declares a basis, no element declares one, and no element-to-CKS or element-to-code passage links are present. |
| Element + specification | One evidenced element has an annotated CKS passage and no annotated code passage; no KO-level basis. |
| Elements + code | Multiple elements, with evidence declared on at least two, each linked to an annotated passage in its own implementation; no annotated CKS passage or KO-level basis. An element can have code detail without its own evidence. |
| Element + specification + code | One evidenced element has both annotated CKS and code passages; no KO-level basis. |

Missing knowledge declarations and mixed or incomplete patterns remain **unclassified**, rather than being assigned a misleading category. These categories are not a score, ranking, or assertion about evidence strength, correctness, or trustworthiness. In particular, “Element + specification” and “Elements + code” describe different dimensions of detail rather than a universal better/worse order. This section defines classification only; source-content resolution and its display are separate implementation steps.

## Validated declaration inventory

Validated against the five source `metadata.json` files on 2026-10-09. The SWA's embedded copies may lag until the next KO replacement. This table records **declared relationships**, not every citation or document found inside a KO. An absent element-level basis must not be inferred from a KO-level source, general documentation, or another knowledge element.

| Object | What is declared | What is deliberately absent |
| --- | --- | --- |
| HBOT Treatment Target Knowledge Assembly | Four constituent KO identifiers and one KA-owned orchestration knowledge element; no `koio:hasEvidentialBasis` relationship. | No KA-owned evidence and no inheritance of the constituents' evidence. |
| DFU Severity Score KO | Two evidential-basis links on the KO itself: Wagner and IWGDF classification guidance. | Neither of its two knowledge elements receives an element-specific basis. |
| HBOT Treatment Decision KO | Its one knowledge element links to the published guideline's Figure 6 as a specific evidence resource. A separate, content-anchored link identifies the full CKS Section 4.3 decision table. | No code-passage annotation; `src/decision.js` remains a file-level implementation link. The CKS's additional validation and out-of-scope decision are not attributed to published Figure 6. |
| HBOT Regimen Burden KO | Regimen Range has the Löndahl 40-session and Fedorko 30-session planning sources. Burden Questionnaire Logic has the dated UHMS facility-list source. Each of the three elements has a Web Annotation identifying one passage in its corresponding JavaScript implementation file, while retaining its file-level `implementedBy` link. | Burden Response Analysis has no separately declared evidential basis; neither the trials nor the facility list is asserted as evidence for its calculation. No CKS passage is annotated. |
| DFU Prognostic Indicator KO | Its knowledge element links to the Margolis supplementary Table 3 resource, a content-anchored CKS Section 5.3 table, and two content-anchored passages in `src/prognosis.js`. | The CKS-owned threshold-equality rule is not attributed to Margolis Table 3. |

Validation covered JSON syntax, JSON-LD-to-RDF expansion of all five graphs, absolute resolution of graph identifiers, existence of every declared local file and interface path, placement of all seven evidential-basis relationships, the KA's exact references to the four KO identifiers, matching recorded SHA-256 digests, and unique exact/prefix/suffix matches for all seven content selectors. External HTTP availability and the current visual contents of linked publications were not revalidated by this structural check. The KA's `dc:source` array still contains one empty object; it contributes no source statement to the RDF graph and should not be mistaken for a declared evidential basis.

Changes to source files or metadata should preserve these distinctions and trigger revalidation of content-based selectors and file digests.
