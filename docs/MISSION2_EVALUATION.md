# Mission 2 detection evaluation

Mission 2 turns the deterministic detector into a measured V0 system. The checked-in corpus contains 360 synthetic, hand-authored/template-composed candidate regions: 288 calibration and 72 held-out, balanced 180 spoilers / 180 benign across TV, movies, sports, games, books, competition, and adversarial language.

These figures measure this synthetic corpus only. They are regression evidence, not a claim of real-world browsing accuracy.

## Reproduce

```powershell
npm run eval
npm run verify
```

`npm run eval` writes `reports/detection-eval.json`. Preserved checkpoints are:

- `reports/mission1-baseline.json`
- `reports/mission2-final.json`

## Baseline versus final at threshold 7

| Split | Detector | TP | FP | TN | FN | Precision | Recall | F1 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Calibration (288) | Mission 1 | 124 | 32 | 112 | 20 | 0.7949 | 0.8611 | 0.8267 |
| Calibration (288) | Mission 2 | 142 | 0 | 144 | 2 | 1.0000 | 0.9861 | 0.9930 |
| Held-out (72) | Mission 1 | 27 | 35 | 1 | 9 | 0.4355 | 0.7500 | 0.5510 |
| Held-out (72) | Mission 2 | 35 | 0 | 36 | 1 | 1.0000 | 0.9722 | 0.9859 |

## Final threshold tradeoff on calibration

| Threshold | Precision | Recall | F1 | FP | FN |
|---:|---:|---:|---:|---:|---:|
| 5 | 0.9726 | 0.9861 | 0.9793 | 4 | 2 |
| 6 | 0.9726 | 0.9861 | 0.9793 | 4 | 2 |
| **7** | **1.0000** | **0.9861** | **0.9930** | **0** | **2** |
| 8 | 1.0000 | 0.9653 | 0.9823 | 0 | 5 |
| 9 | 1.0000 | 0.8750 | 0.9333 | 0 | 18 |

Threshold 7 remains selected. On this corpus, lowering it adds four false positives without recovering the two indirect misses; raising it to 8 increases false negatives without improving precision. Both harms matter, and threshold 7 gives the strongest measured balance.

## Evidence-driven rules added

Calibration errors motivated deterministic indicators for betrayal, relationship outcomes, survival, villain identity, finalists, sent-home outcomes, victory/loss, post-credits scenes, "is actually," secret areas/advantages, live leads, spoiler warnings, and completed "wins" phrasing.

False-positive clusters motivated explicit deductions for:

- spoiler-free and negated outcome language;
- hypotheses, predictions, future-season phrasing, and questions;
- safe metadata such as release schedules, availability, casting, patch notes, trades, and author appearances;
- music-score context;
- demonstrated common-word/entity collisions such as "The Bear market."

The scorer exposes structured term matches, indicator IDs/weights, bonuses, deductions, threshold, and final score. It does not include the candidate's hidden text in the explanation object.

No optional topic category was added. The measured improvements did not require a schema migration or category-specific weights.

## Remaining errors

All three final false negatives are linguistic variants of one indirect book reveal: "the archive is a prison for the narrator's memories." The configured alias is nearby, but no stable outcome phrase appears. A universal `prison` keyword would create a broad and poorly justified rule, so this miss remains intentionally visible in the reports.

The held-out split has no false positives and one false negative. This clean synthetic result should not be extrapolated to live web accuracy; the held-out frames share the same hand-authored scenario families.

## Local feedback schema

`chrome.storage.local` stores:

- `protectedTopics`: user-created names, aliases, enabled state, IDs, and creation timestamps;
- `feedbackStats`: schema version plus per-topic aggregate counts for false positives, missed spoilers, and aliases explicitly added from reports.

It never stores selected page text, candidate bodies, URLs, browsing history, screenshots, or timelines. The missed-spoiler input starts empty; a permanent alias is saved only if the user types and submits it.

## Performance observation

The jsdom large-page regression scanned 600 eligible candidates, protected 12, and measured approximately 175.30 ms for one initial run on this development machine. This is an observation, not a browser performance guarantee or budget.

A burst of 120 inserted posts is compacted into a bounded cached document scan once pending roots exceed 40. The regression observed no more than three total scan calls including startup, and protected the four expected inserted spoilers. No obvious observer loop appeared.
