# Mission 4 deterministic precision recalibration

## Decision

**NOT READY FOR PILOT.** Mission 4 substantially reduced false positives, but the locked detector failed the sealed Mission 3 recall gate. It must not be presented as a product-ready improvement.

The experiment remains fully deterministic. No semantic runtime, model, network inference, telemetry, URL/history collection, or candidate-text persistence was added to production.

## Protocol and data

Mission 4 started at Mission 3 commit `c43106a9aec5169e7610c8dfa5494346c107fcde`. The sealed Mission 3 corpus remained byte-identical at SHA-256 `5bbd4912efbe42f771bd8a54e2916c21b04781bfca126e9754399732ab49fde8`.

The independent Mission 4 corpus contains 840 unique, balanced cases:

- 600 rule-development cases: 300 spoiler / 300 benign
- 240 validation cases: 120 spoiler / 120 benign
- 140 cases in each of TV, movie, sports, game, book, and competition
- seven new fictional topic/entity sets per category
- validation entities and scenario-family identifiers disjoint from development
- corpus SHA-256: `9efe52087ad198a6670a181ee4f5150b9077dce41fcf8a0c5aed2d896eb60be0`

The untouched Mission 3 production detector was reconstructed at its exact base commit in a disposable worktree and measured against the final corpus before detector selection.

## Development results

| Evidence | TP | FP | TN | FN | Precision | Recall | F1 | FPR | FNR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mission 3 detector, all 840 | 241 | 136 | 284 | 179 | .6393 | .5738 | .6048 | .3238 | .4262 |
| Locked detector, all 840 | 315 | 5 | 415 | 105 | .9844 | .7500 | .8514 | .0119 | .2500 |
| Mission 3 detector, development 600 | 175 | 122 | 178 | 125 | .5892 | .5833 | .5862 | .4067 | .4167 |
| Locked detector, development 600 | 300 | 1 | 299 | 0 | .9967 | 1.0000 | .9983 | .0033 | 0 |
| Mission 3 detector, held-out validation 240 | 66 | 14 | 106 | 54 | .8250 | .5500 | .6600 | .1167 | .4500 |
| Locked detector, held-out validation 240 | 15 | 4 | 116 | 105 | .7895 | .1250 | .2158 | .0333 | .8750 |

The strong development result does not generalize to held-out constructions. That failure was preserved; no validation wording was mined for new rules.

## Baseline false-positive taxonomy

The untouched detector's 136 false positives were dominated by:

| Family | Count |
|---|---:|
| Predictions | 25 |
| Conditionals | 20 |
| Spoiler-free reviews | 20 |
| Language collisions | 15 |
| Dramatic review language | 15 |
| Held-out emotional reviews | 8 |
| Questions | 5 |
| Quoted speculation | 5 |
| Historical results | 5 |
| Award collisions | 5 |
| Lineups | 5 |
| Held-out health/roster/title | 6 |
| Injury/schedule | 2 |

## Structured detector

`detector-v0.4-structured` replaces flat indicator accumulation with explicit evidence:

- topic relevance and distinct/common alias handling
- asserted, speculative, questioned, conditional, and negated epistemic status
- future, live, completed, historical, and unknown temporal status
- concrete result/state/identity/relationship reveal evidence
- metadata, review, schedule, prediction, and collision safeguards
- a named final rule path included in `DetectionExplanation`

Topic presence is necessary but not sufficient. Multiple topic terms improve relevance evidence but no longer constitute a spoiler by themselves. Common/short aliases require a completed outcome with strong reveal evidence. The external detection and DOM-protection interfaces remain stable.

## Lock evidence

The detector was locked before the Mission 3 gate:

- version: `detector-v0.4-structured`
- source SHA-256: `f004e26f2cfaec92699d1e14d59a90965dce58d90a120d01832253c1a48caa8f`
- working-diff Git blob: `288a4b6c1bfa38ec4ffe0dfc30913942f68870a2`
- threshold: 7
- lock record: [`eval/mission4/detector-lock.json`](../eval/mission4/detector-lock.json)

No detector or policy changes were made after the frozen gate.

## Sealed Mission 3 gate

| Detector | TP | FP | TN | FN | Precision | Recall | F1 | FPR | FNR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mission 3 baseline | 253 | 106 | 194 | 47 | .7047 | .8433 | .7678 | .3533 | .1567 |
| Mission 4 locked | 42 | 31 | 269 | 258 | .5753 | .1400 | .2252 | .1033 | .8600 |

Mandatory targets all failed except false-positive count:

- precision >= .90: **FAIL**
- recall >= .80: **FAIL**
- F1 >= .85: **FAIL**
- FP <= 33: **PASS** (31)
- no catastrophic slice collapse: **FAIL**

Benign-adversarial improved from 35 FP / 25 TN / .5833 FPR to 6 FP / 54 TN / .1000 FPR, meeting the <=12 FP target. Its spoiler recall, however, fell to .2167.

Indirect-reveal changed from TP 47 / FP 30 / TN 30 / FN 13 / precision .6104 / recall .7833 to TP 0 / FP 0 / TN 60 / FN 60 / precision 0 / recall 0. Linguistic-held-out also fell to zero recall. This is a catastrophic recall collapse.

## Mission 2 regression

On the original 360-case corpus, the locked detector scored TP 171, FP 0, TN 180, FN 9, precision 1.0000, recall .9500, F1 .9744, FPR 0, and FNR .0500. This remains strong regression evidence, though recall is lower than Mission 3's TP 177 / FN 3 result.

## Browser and performance evidence

The full browser suite has 12 independent scenarios: eight production scenarios and four isolated Mission 3 research-lab scenarios. The new production scenario verifies predictions, questions, theories, conditionals, metadata, schedules, and a common-word collision remain readable while confirmed and dynamically inserted spoilers are concealed; Reveal also works. Existing scenarios retain `Not a spoiler`, missed-spoiler reporting, persistence, multiple topics, and mutation behavior.

Development-machine jsdom observations:

- 600 candidates: 12 protected, approximately 174 ms initial scan
- 120-item mutation burst: 6 protected, approximately 123 ms
- unchanged rescan: 0 candidates reprocessed

These are regression observations, not universal browser-performance claims.

## Privacy, security, and packaging

- production permission remains `storage`
- no network API or external endpoint was added
- no page text, URL, or history is persisted or logged
- storage remains limited to protected topics and aggregate feedback statistics
- DOM rendering continues to use created elements and `textContent`, not untrusted HTML
- Mission 3 model/WASM/semantic assets are absent from `dist`
- Mission 3 production: 53,512 bytes on disk / 16,082 bytes ZIP
- Mission 4 production: 54,640 bytes on disk / 16,956 bytes ZIP
- growth: 1,128 bytes on disk / 874 bytes ZIP

## Conclusion

The structured policy proves deterministic epistemic and temporal safeguards can sharply reduce false positives without bundle or privacy cost. It also proves that rules selected on known construction families do not generalize to novel indirect assertions. Because sealed-gate recall collapsed, this detector is **not ready for a bounded real-browsing pilot**. The next experiment should redesign the corpus and policy around construction-level generalization, not expand phrase lists.
