# Information Blackout — technical research guide

Publication boundary: this is not ready for pilot browsing. Use the local hostile/layout fixtures only. Optional semantic-lab reproduction commands below describe historical research; they require separately obtaining the upstream model artifacts described in `third_party/MODEL_PROVENANCE.md`, which are excluded from this public snapshot. The semantic candidate is not adopted.

Information Blackout is a local-first Chrome/Edge extension that conceals likely spoilers for topics you choose. Mission 1 implements a real Manifest V3 extension and the complete MVP loop: add a topic, browse a local fixture, locally score likely spoiler regions, conceal the smallest sensible match, and reveal one region on demand.

The deterministic research extension uses deterministic heuristics. It does **not** run semantic AI, an LLM, embeddings, a cloud service, telemetry, or browsing-history collection; Mission 3 retains a non-adopted offline/local feasibility lab only.

Mission 2 adds a 360-case offline corpus, reproducible precision/recall evaluation, structured scoring explanations, local false-positive aggregates, and a conservative missed-spoiler reporting flow. See [Mission 2 detection evaluation](docs/MISSION2_EVALUATION.md) for baseline/final metrics and limitations.
Mission 3 evaluated a genuine fully local MiniLM semantic candidate on a separate 600-case OOD challenge and **rejected adoption**: the hybrid failed the 0.97 precision gate and produced a roughly 37.2 MB experimental lab build. The production extension remains deterministic and unchanged. See [Mission 3 local semantic trial](docs/MISSION3_SEMANTIC_TRIAL.md).
Mission 4 evaluated structured deterministic reasoning on a new 840-case corpus. It sharply reduced development false positives but failed the sealed Mission 3 recall gate, so the result is **not ready for pilot browsing**. See [Mission 4 deterministic recalibration](docs/MISSION4_DETERMINISTIC_RECALIBRATION.md).


## Current MVP capabilities

- Add protected topics with a name, optional aliases, and an enabled state.
- View, enable/disable, and delete locally stored topics.
- Scan conservative text candidates such as headings, posts, cards, paragraphs, comments, list items, captions, and blockquotes.
- Score topic terms, aliases, repeated/co-occurring protected terms, spoiler-indicator phrases, local proximity, and context density.
- Conceal a matched region while preserving its approximate footprint.
- Reveal one region without disabling the topic or reloading the page.
- Debounce and scan relevant content inserted after page load.
- Avoid duplicate/nested overlays and extension-owned UI.

## Install the unpacked extension

Prerequisites: Node.js 24 and npm. Chromium is only needed for the automated browser test.

```powershell
npm install
npm run build
```

Then:

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select the generated `information-blackout/dist` directory—not the repository root.
5. Pin or open Information Blackout, add a topic, and open only a locally served fixture as described below.

The extension runs from built files and does not require a development server.

## Try the hostile fixture manually

After adding both example topics below, serve the repository from its root with any local static HTTP server and open `fixtures/hostile.html` through `http://127.0.0.1`. Chrome does not inject HTTP content scripts into a `file://` page unless separate file access is granted, which this extension does not request by default.

- `Severance` with aliases `Lumon`, `Mark Scout`, and `Macrodata Refinement`
- `Denver Nuggets` with aliases `Nuggets`, `Jokic`, and `Nikola Jokic`

The obvious, alias-context, sports-result, and nested spoiler headlines should be concealed. The ordinary viewing/streaming references, sports schedule, and generic spoiler-word noise should remain visible. Press **Load another feed item** to verify dynamic protection, then press **Reveal** on one protected region.

## Commands

```powershell
npm install              # install development dependencies
npm run eval:m3:baseline # Mission 2 detector on the frozen Mission 3 OOD corpus
npm run eval:m3:semantic # semantic-only and hybrid trial on that same checksum
npm run eval:m4          # locked detector on the independent Mission 4 corpus
npm run build:m3:lab     # build the isolated, non-adopted local Chromium lab
npm run typecheck        # strict TypeScript check
npm test                 # unit + jsdom DOM/integration tests
npm run eval            # evaluate calibration/held-out precision, recall, F1, and failures
npm run test:unit        # deterministic engine/model tests only
npm run test:dom         # DOM protection tests only
npm run build            # produce the loadable dist directory
npx playwright install chromium  # one-time matching local browser install
npx playwright test tests/e2e/extension.spec.ts tests/e2e/mission2.spec.ts # deterministic extension checks
# npm run test:e2e / npm run verify also build the historical semantic lab; omitted model assets are required.
```

## Architecture

- `src/shared/topic.ts`: protected-topic model, bounds, construction, and alias parsing.
- `src/storage/topics.ts`: topic-configuration persistence; reads/writes topic configuration in `chrome.storage.local`.
- `src/semantic/`: reversible local classifier/head/gate boundaries and the isolated worker lab; not imported by the production build.
- `eval/mission3/`: the checksummed OOD challenge, baseline/semantic evaluators, and checksum history.
- `eval/mission4/`: independent development/held-out corpus, evaluator, and pre-gate detector lock.
- `src/storage/feedback.ts`: browser-local per-topic feedback aggregates.
- `third_party/`: upstream model provenance and runtime license notices; model/tokenizer/config assets are excluded from this snapshot.
- `src/detection/normalize.ts`: deterministic text normalization and whole-phrase matching.
- `src/detection/scorer.ts`: browser-independent structured deterministic engine with relevance, reveal, epistemic, temporal, and benign-context evidence.
- `src/content/protector.ts`: candidate selection, minimal nested-region choice, safe overlay rendering, reveal, idempotency, and mutation handling.
- `src/content/index.ts`: content-script bootstrap and storage-change integration.
- `src/ui/`: framework-free popup management UI.
- `fixtures/hostile.html`: adversarial fixture categories A–G, including a dynamic feed.
- `tests/`: unit, jsdom DOM/integration, and real Chromium extension tests.

The detection engine accepts plain text plus topic records and has no DOM or extension API dependency. A later contextual classifier can implement the same result boundary without replacing scanning, concealment, storage, or UI code.

## Detection logic

Protection is topic-gated: generic words such as “winner,” “death,” or “finale” cannot trigger concealment without a configured topic name or alias in the same candidate region.

The default threshold remains `7`, but the decision is structured rather than a flat word sum. The detector records:

- topic relevance and alias specificity
- concrete outcome, state, identity, and relationship evidence
- asserted, speculative, questioned, conditional, and negated status
- future, live, completed, historical, and unknown temporal status
- metadata, review, schedule, prediction, and collision safeguards
- a final named rule path for tests and debugging

Examples: a lone “Severance” mention stays visible, a prediction or question remains visible, and an asserted “Severance finale reveals…” statement is protected. “Denver Nuggets game tonight” remains future context, while a completed result with a scoreline and outcome evidence is protected.

These are deterministic heuristics, not semantic understanding. Mission 4's sealed-gate failure documents their construction-level generalization limit.

## Privacy and permissions

Stored data includes protected-topic configuration (topic ID, name, aliases, enabled state, creation timestamp) and local per-topic false-positive, missed-spoiler and alias-added counters. Page text, URLs, and browsing history are neither stored nor transmitted.

Manifest access is intentionally limited:

- `storage`: persists protected topics and preferences locally in `chrome.storage.local`.
- `http://*/*` and `https://*/*` content-script matches: required for automatic spoiler protection on ordinary web pages. The extension does not request file-page access, browser history, tabs, activeTab, scripting, webRequest, cookies, identity, or network interception.

There are no runtime network requests, remote endpoints, telemetry libraries, analytics, remote models, or page-text persistence. Development tooling may download npm packages and the local Playwright browser during setup; the installed extension itself does not make network calls.

User-supplied topic names and page strings are rendered with `textContent`; extension code does not interpolate them into HTML. The content renderer does not use `innerHTML`. DOM nodes are temporarily moved into a concealed wrapper and restored as the same nodes on reveal, preserving their listeners.

## Current limitations

- Keyword/rule scoring cannot understand meaning, sarcasm, negation, pronouns, images, audio, or video.
- Structured rules still miss novel implication-heavy and pronoun/reference constructions.
- A spoiler that avoids the configured title/aliases is a false negative.
- Very long candidate regions over 1,500 characters are skipped to bound work.
- Candidate selectors cannot cover every site's custom component structure.
- Shadow DOM, cross-origin frames, canvas text, and closed component trees are not inspected.
- A site can substantially restyle or restructure a region after it is protected.
- Site access is broad because automatic protection on arbitrary HTTP/HTTPS pages is the core product behavior; per-site opt-in is not part of Mission 1.

## Future extension points

The highest-leverage next step is a construction-level generalization study with a sealed, independently authored validation protocol. The DOM, storage, popup, and reveal layers remain independent of the scorer.
