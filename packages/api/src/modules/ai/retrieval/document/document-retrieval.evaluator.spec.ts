import { DocumentRetrievalEvaluator } from './document-retrieval.evaluator';

describe('DocumentRetrievalEvaluator', () => {
  const evaluator = new DocumentRetrievalEvaluator();
  const golden = [
    {
      id: 'exact-error-code',
      relevantChunkIds: ['auth-errors'],
      returnedChunkIds: ['auth-errors', 'overview'],
      citedChunkIds: ['auth-errors'],
      latencyMs: 42,
    },
    {
      id: 'semantic-policy',
      relevantChunkIds: ['policy-scope', 'policy-example'],
      returnedChunkIds: ['policy-scope', 'other', 'policy-example'],
      citedChunkIds: ['policy-scope'],
      latencyMs: 55,
    },
  ];

  it('computes the offline quality and latency gate metrics', () => {
    const metrics = evaluator.evaluate(golden);
    expect(metrics).toMatchObject({
      recallAtK: 1,
      mrr: 1,
      citationPrecision: 1,
      p95LatencyMs: 55,
      caseCount: 2,
    });
    expect(metrics.ndcg).toBeGreaterThan(0.9);
    expect(() => {
      evaluator.assertThresholds(metrics, {
        recallAtK: 0.9,
        mrr: 0.8,
        ndcg: 0.8,
        citationPrecision: 0.95,
        p95LatencyMs: 100,
      });
    }).not.toThrow();
  });

  it('reports every failed gate', () => {
    expect(() => {
      evaluator.assertThresholds(evaluator.evaluate([]), {
        recallAtK: 0.9,
        mrr: 0.8,
        ndcg: 0.8,
        citationPrecision: 0.95,
        p95LatencyMs: 100,
      });
    }).toThrow('Recall@K, MRR, nDCG');
  });
});
