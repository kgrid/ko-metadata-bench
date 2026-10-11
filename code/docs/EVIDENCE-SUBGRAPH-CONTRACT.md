# Evidence-linking subgraph contract

This contract defines the **one-KO Explore graph** for the K view. It governs both SWA editions. The graph is a narrow projection of declarations in that object's `metadata.json`, not a general KO file map, a clinical-evidence score, or an inferred chain of support. The existing [evidence metadata progression](EVIDENCE-METADATA-PROGRESSION.md) supplies the five teaching patterns; this contract does not assign a pattern by KO name or workshop position.

## Permitted nodes

| Kind | Inclusion rule |
| --- | --- |
| Knowledge Object | The selected object's metadata subject; the anchor for KO-level basis links. |
| Knowledge element | An element declared by `koio:hasKnowledge`, not a constituent-KO reference. Include an element when it has an evidential-basis or relevant annotation route; a minimal contextual element may also explain a deliberate absence. |
| Evidential resource | A resource actually named by `koio:hasEvidentialBasis`, or its declared parent/part needed to identify a specific cited resource. A general `dc:source` citation alone does not qualify. |
| Annotation | A `schema:subjectOf` annotation targeting a specification or implementation passage. Evidence-target annotations remain in source metadata and can be inspected from their evidence-resource node, but are not drawn as a second evidence route. |
| Specification passage | A named `oa:SpecificResource` within a declared specification document, targeted by an applicable annotation and bearing a `oa:TextQuoteSelector`. |
| Implementation passage | A named `oa:SpecificResource` within an element's implementation file, targeted by an applicable annotation and bearing a `oa:TextQuoteSelector`. |

Each node carries a stable identifier from the metadata, its kind, a readable label, and provenance back to the source declaration. A passage additionally carries its containing file path, selector, recorded digest if present, and resolution status. Labels and display positions never serve as graph identity. An unresolved but declared passage stays a passage node with an unresolved status; it is not replaced by a whole-file node.

## Permitted directed relationships

| Kind | From → to | Declared source |
| --- | --- | --- |
| Evidential basis | KO or element → evidential resource | `koio:hasEvidentialBasis` on that exact subject |
| Evidence part | Evidential resource → named evidential part | `schema:hasPart` on the parent source |
| Subject of annotation | KO or element → annotation | `schema:subjectOf` on that exact subject |
| Annotation target | Annotation → specification passage or implementation passage | The annotation's `target`, resolved to the named passage |

The annotation inspector retains its `body`, motivation, target identifier, and the target's `schema:hasPart`, `oa:hasSource`, and selector declarations. A passage target route is usable only when its body matches the declaring subject and the target is connected to a named resource. The graph does not collapse subject → annotation → target into a purported direct RDF triple. Selecting a relationship exposes the actual source statement or annotation route. Annotations targeting evidential resources remain valid metadata; the evidence-resource inspector names them without drawing a redundant right-hand route.

## File context is not a passage link

`implementedBy` and KO specification-document links are **file-level context**, not passage-level graph edges. The UI may show a file as a container around an annotated passage or mention a file-level link in the inspector, but it must not draw a passage edge unless a qualifying annotation and selector are declared. A passage edge terminates at the passage *inside* its file, never at the file as a whole. The file's `schema:hasPart` declaration remains available in the inspector as the passage's containment evidence.

Missing basis links, absent CKS/code annotations, and non-inherited constituent-KO evidence may be explained with **Not declared** text. Such explanations are not nodes or edges. No edge may be inferred between evidence and a specification or implementation merely because both connect to the same knowledge element. The graph excludes unrelated files, tests, services, generic documentation, and unconnected citations. These rules preserve the difference between linking specificity and evidence quality.

## Claims the graph must not make

1. **Absence is not a relationship.** If an evidential basis, specification passage, or implementation passage is not declared for the selected subject, show a plain “Not declared” state at that position. Do not draw an empty, dashed, implied, or “missing” edge. An unresolved *declared* target is different: retain its declared route and mark the target unresolved.
2. **The KA does not inherit evidence.** Build its graph solely from declarations whose subject is the KA or one of its own declared knowledge elements. Constituent-KO references do not import those KOs’ evidential resources, annotations, or passage links. “No direct evidence links” means none are declared for the KA; it does not assess the constituent KOs.
3. **A route through an element is not a direct assertion.** An element may have both `koio:hasEvidentialBasis` and a `schema:subjectOf` annotation targeting a code or CKS passage. Display those as separate, provenance-preserving branches from the element. Do not draw or label an evidential-resource → code/CKS edge, or claim the source directly supports that passage, unless a separate relationship explicitly declares it.

These prohibitions apply equally to graph edges, arrow captions, node details, summaries, and accessibility text. The Explore view may explain a route in ordinary language, but must identify each declared step and must not turn the visual sequence into a stronger metadata claim.
