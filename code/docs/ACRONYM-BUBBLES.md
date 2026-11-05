# Acronym bubbles

The first implementation is limited to the displayed KO or KA **name in a main-view banner-tab**. It does not change the name, identifier, or metadata stored in a KO/KA. The shared contract is `app/acronym-bubble-scope.js`; the standalone edition receives that same contract during the build.

| View | Eligible name |
| --- | --- |
| Knowledge Objects | KO banner-tab name (including a KA after it is loaded as a KO) |
| Metadata Rig | KO banner-tab name (including a loaded KA) |
| Knowledge (K) | KO banner-tab name (including a loaded KA) |
| Findability (F) | KO banner-tab name (including a loaded KA) |
| Access (A) | KO banner-tab name (including a loaded KA) |
| Interoperability (I) | KO banner-tab name (including a loaded KA) |
| Reusability (R) | KO banner-tab name (including a loaded KA) |
| Knowledge Assembly | The KA name in its main bar |

The contract excludes view titles, navigation buttons, facet names/counts, case and orchestration content, dialogs, metadata tables and source text, citations, files and paths, search results, and arbitrary occurrences of an acronym elsewhere in the app. In particular, it does not scan the page for acronym-like text.

## Written-out forms

The separate shared registry, `app/acronym-bubble-registry.js`, contains only `DFU → Diabetic Foot Ulcer` and `HBOT → Hyperbaric Oxygen Therapy` for the first implementation. A bubble contains only that written-out form, with no explanatory prose. The displayed banner name remains abbreviated, and the KO/KA source metadata is unchanged.

## Interaction contract

`app/acronym-bubble-behavior.js` provides reusable interaction logic, without styling or positioning. A caller registers an acronym anchor and its written-out form, then supplies show/hide rendering callbacks. The shared controller allows only one active bubble:

- Mouse or pen pointer entry opens it; pointer exit closes it.
- Keyboard focus opens it; blur closes it. Escape closes an open bubble before a containing dialog handles Escape.
- A touch press toggles it; a press outside closes it.
- Registering an anchor returns a cleanup function; destroying the controller removes all listeners.

The standalone edition receives the same scope, registry, and behavior sources during build.

## Visual treatment

`app/acronym-bubble-view.js` builds a text-only bubble from the registry expansion. It uses the SWA's near-white surface, dark text, fine gray border, rounded corners, a small pointer, and a restrained shadow. The reusable acronym anchor has a subtle dotted underline and visible keyboard focus. It does not use the browser's native `title` tooltip. The standalone edition receives the same renderer during build, and both editions carry matching styles.

The marker and bubble are now attached only to eligible live banner names in both editions.

## Placement

The shared `positionAcronymBubble` routine measures the acronym and rendered bubble. It prefers a position just below the acronym, flips above when space requires, and can shift horizontally to avoid neighboring controls in the same banner. It clamps the card and its pointer within the viewport. The card uses fixed positioning, so opening it does not alter the banner's size or move its buttons.

## Banner attachment

`app/acronym-bubble-attachment.js` uses an explicit list of main-view banner-name selectors. It splits only those displayed names at registry acronyms, leaving the visible abbreviation and all source metadata unchanged. The shared behavior controls one floating bubble at a time; KO/KA banner actions still work. The attachment watches the workspace for later view changes and KA loading, and cleans up its listeners when disposed. Dialogs, facet content, files, and unrelated text are never scanned for acronyms.
