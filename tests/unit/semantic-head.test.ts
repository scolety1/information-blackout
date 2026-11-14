import { describe, expect, it } from "vitest";
import artifactJson from "../../src/semantic/artifacts/spoiler-head.json";
import { predictWithHead, type SemanticHeadArtifact } from "../../src/semantic/head";

const artifact = artifactJson as SemanticHeadArtifact;

describe("local semantic classification head", () => {
  it("is a fixed 384-dimension learned artifact with reproducibility metadata", () => {
    expect(artifact.modelId).toBe("Xenova/all-MiniLM-L6-v2");
    expect(artifact.modelRevision).toBe("751bff37182d3f1213fa05d7196b954e230abad9");
    expect(artifact.embeddingDimensions).toBe(384);
    expect(artifact.weights).toHaveLength(384);
    expect(artifact.trainingCases).toBe(960);
    expect(artifact.validationCases).toBe(240);
    expect(artifact.threshold).toBeGreaterThan(0);
    expect(artifact.threshold).toBeLessThan(1);
  });

  it("returns a bounded probability and rejects incompatible embeddings", () => {
    const probability = predictWithHead(new Float32Array(384).fill(0.01), artifact);
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(1);
    expect(() => predictWithHead(new Float32Array(8), artifact)).toThrow(/dimension mismatch/u);
  });
});
