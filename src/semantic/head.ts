export interface SemanticHeadArtifact {
  schemaVersion: 1;
  modelId: string;
  modelRevision: string;
  embeddingDimensions: number;
  seed: number;
  threshold: number;
  weights: number[];
  bias: number;
  trainingCases: number;
  validationCases: number;
  trainingDataChecksum: string;
}

export interface SemanticResult {
  status: "ready" | "disabled" | "failed" | "overloaded";
  spoilerProbability: number;
  shouldProtect: boolean;
  threshold: number;
  modelId: string;
}

function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exponent = Math.exp(value);
  return exponent / (1 + exponent);
}

export function predictWithHead(embedding: ArrayLike<number>, artifact: SemanticHeadArtifact): number {
  if (embedding.length !== artifact.embeddingDimensions || artifact.weights.length !== artifact.embeddingDimensions) {
    throw new Error(`Semantic embedding dimension mismatch: expected ${artifact.embeddingDimensions}, received ${embedding.length}.`);
  }
  let logit = artifact.bias;
  for (let index = 0; index < artifact.embeddingDimensions; index += 1) {
    logit += (embedding[index] ?? 0) * (artifact.weights[index] ?? 0);
  }
  return sigmoid(logit);
}
