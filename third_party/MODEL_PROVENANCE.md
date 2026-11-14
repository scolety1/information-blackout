> Public snapshot note: the model/tokenizer/config artifacts described below were present in the local research source but are deliberately excluded from this publication. This document preserves upstream provenance for optional reproduction, not a claim that weights are included.

# Mission 3 semantic trial provenance

The semantic candidate was evaluated and rejected; these artifacts are retained only for reproducibility and the isolated lab.

## Embedding model

- Model: `Xenova/all-MiniLM-L6-v2`
- Upstream model: `sentence-transformers/all-MiniLM-L6-v2`
- Source: <https://huggingface.co/Xenova/all-MiniLM-L6-v2>
- Pinned upstream revision: `751bff37182d3f1213fa05d7196b954e230abad9`
- License: Apache License 2.0
- Runtime format: quantized ONNX (`model_quantized.onnx`)
- Artifact SHA-256: `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`
- Vendored model files: 23,685,048 bytes
- Architecture: six-layer MiniLM sentence encoder producing a 384-dimensional mean-pooled normalized embedding
- Redistribution assessment: the Apache-2.0 model card/license permits redistribution when its conditions and notices are retained. The repository retains the runtime/package license text. No material licensing blocker was identified.

## Classification head

- Architecture: 384-weight logistic-regression head plus bias
- Training: 960 separate synthetic training cases; 240 validation cases
- Training checksum: `4b0246ce798b6380140e7c983cb3db12ab14784f26cb7140c4785aee8c48d87f`
- Seed recorded in artifact: `3102026`
- Frozen OOD cases were never used for training or head-threshold selection.
- Head SHA-256: `5095aad079d1c2059669fb2d255692d32b18b5e5d11b9d0d38316a9e83f2e4f0`
- Head size: 6,848 bytes

## Runtime

- Library: `@huggingface/transformers` 4.2.0, Apache-2.0
- Inference backend: `onnxruntime-web` 1.26 development build selected by the pinned library, MIT
- Development dependency overrides: `sharp` 0.35.3 and `adm-zip` 0.6.0 remediate current npm advisories in Node-only dependency paths; final `npm audit` reports zero known vulnerabilities.
- Browser lab: Manifest V3 offscreen document hosting a dedicated module worker, local model/WASM files, `env.allowRemoteModels = false`, and `env.useWasmCache = false` to avoid blob-module CSP conflicts.

The production extension does not contain or invoke this model. Its shipped manifest, permissions, build, storage, and deterministic runtime remain Mission 2 behavior.
