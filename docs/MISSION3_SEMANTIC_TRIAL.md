# Mission 3 local semantic adoption trial

## Decision

**REJECT.** The local MiniLM candidate is technically real and browser-feasible in an isolated lab, but it fails the accuracy and packaging adoption gates. It is not wired into the production extension.

Mission 2's deterministic engine remains the shipped architecture. The semantic code is bounded behind `LocalSemanticClassifier` and `HybridTrialEngine`, and is removable without touching topic storage, concealment, Reveal, feedback, or popup code.

## Frozen OOD corpus

The final challenge contains 600 balanced synthetic/fictitious cases:

- 120 development
- 120 entity-held-out
- 120 linguistic-family-held-out
- 120 indirect-reveal challenge
- 120 benign-adversarial challenge
- 100 each for TV, movies, sports, games, books, and competition
- 120 indirect-reveal-tagged spoilers
- 180 benign-adversarial-tagged cases
- 300 spoilers / 300 benign

Every final candidate text is unique. Development and entity-held-out topics/aliases are disjoint. Linguistic family tags are held out as groups. The OOD corpus uses invented titles and entities and shares no cases with the separate 1,200-case semantic training/validation set.

Final SHA-256:

`5bbd4912efbe42f771bd8a54e2916c21b04781bfca126e9754399732ab49fde8`

Validation found and explicitly repaired a pre-final freeze defect: the original checksum `452769164e40f2ec981a1e8728f23319dbc119da306575066bbbfc410bd4fc9d` contained 140 duplicate texts and some entity overlap. An intermediate checksum had ambiguous slice tags. [The checksum history](../eval/mission3/challenge-checksum-history.json) records both corrections. The learned head and semantic threshold were not retrained or retuned after the repair; all final metrics below use only the final checksum.

## Accuracy

Overall frozen challenge:

| Detector | TP | FP | TN | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mission 2 deterministic | 253 | 106 | 194 | 47 | 0.7047 | 0.8433 | 0.7678 |
| Semantic only | 79 | 11 | 289 | 221 | 0.8778 | 0.2633 | 0.4051 |
| Hybrid trial | 277 | 111 | 189 | 23 | 0.7139 | 0.9233 | 0.8052 |

Split metrics:

| Split | Deterministic P/R/F1 (FP/FN) | Semantic P/R/F1 (FP/FN) | Hybrid P/R/F1 (FP/FN) |
|---|---|---|---|
| Development | .8154 / .8833 / .8480 (12/7) | .9091 / .3333 / .4878 (2/40) | .8169 / .9667 / .8855 (13/2) |
| Entity-held-out | .8154 / .8833 / .8480 (12/7) | .8421 / .2667 / .4051 (3/44) | .8261 / .9500 / .8837 (12/3) |
| Linguistic-held-out | .7344 / .7833 / .7581 (17/13) | .7619 / .2667 / .3951 (5/44) | .7260 / .8833 / .7970 (20/7) |
| Indirect-reveal challenge | .6104 / .7833 / .6861 (30/13) | .9167 / .1833 / .3055 (1/49) | .6265 / .8667 / .7273 (31/8) |
| Benign-adversarial challenge | .6023 / .8833 / .7162 (35/7) | 1.0000 / .2667 / .4211 (0/44) | .6196 / .9500 / .7500 (35/3) |

The hybrid recovered 11 of the 26 deterministic misses carrying the indirect-reveal tag: a 42.31% relative reduction. It also introduced five new false positives and removed none. No hybrid development gate candidate simultaneously achieved 0.97 precision and routed at most half the cases.

These are synthetic OOD regression results, not claims about live browsing accuracy.

## Hybrid gate

The gate was selected using only the development split:

- deterministic score below 3.5: high-confidence benign
- score 7 or above: high-confidence spoiler
- score from 3.5 through less than 7: semantic escalation

Frozen overall routing:

- candidates: 600
- deterministic high-confidence benign: 90
- deterministic high-confidence spoiler: 359
- gray-zone semantic escalations: 151 (25.17%)

The lab temporarily hides only gray-zone candidate regions until the result arrives. It never hides the entire page. Deterministic high-confidence spoilers remain protected if semantic initialization or inference fails.

## Performance and packaging observations

Development-machine Node/WASM measurements:

- observed initialization range across recorded final-corpus runs: approximately 371-1,105 ms
- observed first warm single-candidate range: approximately 16-37 ms
- observed warm single p50 range: approximately 4-8 ms
- observed warm single p95 range: approximately 13-23 ms
- observed 600-candidate batch range: approximately 1,463-2,327 ms
- observed RSS delta after model initialization: approximately 64.8-69.4 MB

The Chromium lab completed initialization/protection in roughly 0.8-2.0 seconds across observed runs and processed an 80-post dynamic burst in roughly 0.8-2.3 seconds after warm initialization. These are development observations, not browser performance promises.

Package measurements:

| Build/artifact | On disk | ZIP |
|---|---:|---:|
| Mission 2 production build | 53,512 B | 16,082 B |
| Mission 3 production build without semantic assets | 53,512 B | 16,082 B |
| Semantic model files | 23,685,048 B | included below |
| Learned head | 6,848 B | included below |
| Isolated semantic-enabled lab | 37,194,125 B | 19,901,370 B |

The model/WASM/runtime make the lab roughly 695 times the on-disk production build. That impact is disproportionate given the failed precision gate.

## Browser architecture and CSP

The successful isolated lab uses:

`content lab -> Manifest V3 service worker coordinator -> offscreen document -> dedicated module worker -> local Transformers.js/ONNX/WASM`

Direct content-script workers were not reliable with extension-origin module URLs. Direct service-worker inference failed because ONNX Runtime uses dynamic module loading, which service workers disallow. An offscreen document with reason `WORKERS` provides a legitimate worker host. The lab needs the `offscreen` permission and the standard Manifest V3 `wasm-unsafe-eval` CSP token required for packaged WASM. It uses no remote code and no CSP bypass.

The production manifest is unchanged and still requests only `storage`; the lab-only permission was not adopted.

## Privacy and failure behavior

- Remote models are disabled in runtime configuration.
- Model, tokenizer, head, runtime, and WASM are packaged locally.
- Only a candidate region of at most 1,500 characters plus the protected topic name is sent through extension-internal message channels.
- Inputs remain ephemeral in memory and are never written to storage or logs.
- URLs, history, full pages, and unrelated navigation are not model inputs.
- Browser instrumentation observed no non-fixture HTTP(S) request during local initialization and classification.
- A forced worker-initialization failure fell back to the deterministic decision and retained high-confidence protection.
- The queue caps pending classifications at 32 and responds `overloaded` beyond that bound.

## Reproduce

```powershell
npm run eval:m3:baseline
npm run eval:m3:semantic
npm run build:m3:lab
npx playwright test tests/e2e/mission3-semantic-lab.spec.ts
npm run verify
```

Model acquisition and training are separate explicit development commands:

```powershell
node scripts/fetch-mission3-model.mjs
node scripts/train-mission3-head.mjs
```

Normal extension operation performs neither command and makes no remote inference request.
