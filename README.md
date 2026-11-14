# Information Blackout — detection research

A Manifest V3 browser-extension research project about concealing likely spoilers locally. The key result is a failed generalization gate: a promising development score did not survive held-out evaluation.

## What works today

Deterministic topic/alias detection, DOM conceal/reveal, dynamic rescanning, local settings and feedback, offline evaluation corpora, and an isolated non-adopted semantic feasibility lab.

## Contribution

A project by [Spencer Colety](https://github.com/scolety1), developed with AI assistance. The source history records `scolety1`; it does not establish independently hand-written line ownership. The inspectable contribution is the project implementation and evaluation structure, with precise boundaries described in [PROVENANCE.md](PROVENANCE.md).

## Run it

Node.js 24. From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run eval
npm run eval:m4
```

See the [technical guide](GUIDE.md) for local fixture/demo steps and browser testing. No paid API or production credentials are needed. For browser tests, install the matching Chromium with `npx playwright install chromium`.

## Start reading here

- [Content-script entry](src/content/index.ts) and [topic settings UI](src/ui/popup.ts).
- [Deterministic recalibration report](docs/MISSION4_DETERMINISTIC_RECALIBRATION.md).
- [Browser integration tests](tests/e2e/extension.spec.ts) and [model provenance](third_party/MODEL_PROVENANCE.md).

## Verification and limitations

Verified November 14, 2026: 75 unit/DOM tests and eight browser integration tests passed; typecheck and extension build passed. The Mission 4 evaluation reproduced held-out precision 0.7895 and recall 0.1250. Successful software tests do not make the detector ready for real browsing.

Not ready for pilot use. Use only the provided local fixtures when trying it. The semantic candidate was rejected, is not part of the extension, and was not rerun for publication. No browsing history, model weights, telemetry, cloud inference or real browsing records are included. Test corpora contain fictional spoiler-like assertions about named media/sports; they are evaluation text, not factual reporting.
