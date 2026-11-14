import type { SemanticResult } from "./head";

export interface LocalSemanticClassifier {
  initialize(forceFailure?: boolean): Promise<SemanticResult["status"]>;
  classify(input: string): Promise<SemanticResult>;
  dispose(): void;
}
