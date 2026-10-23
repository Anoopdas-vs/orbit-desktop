/**
 * Pure TypeScript deterministic cosine similarity vector search engine.
 * Generates character 3-gram term-frequency vectors for robust semantic matching
 * across English and Malayalam text without external heavy native libraries.
 */

export class SemanticVectorEngine {
  /**
   * Compute character 3-gram frequencies as a sparse/dense embedding map.
   */
  public static embed(text: string): Map<string, number> {
    const vector = new Map<string, number>();
    const clean = text.toLowerCase().replace(/[\r\n\t]+/g, ' ').trim();
    if (!clean) return vector;

    const n = 3;
    for (let i = 0; i <= clean.length - n; i++) {
      const gram = clean.slice(i, i + n);
      vector.set(gram, (vector.get(gram) || 0) + 1);
    }

    // Normalize magnitude
    let sumSquares = 0;
    for (const val of vector.values()) {
      sumSquares += val * val;
    }
    const magnitude = Math.sqrt(sumSquares);
    if (magnitude > 0) {
      for (const [key, val] of vector.entries()) {
        vector.set(key, val / magnitude);
      }
    }

    return vector;
  }

  /**
   * Compute cosine similarity between two text strings (0.0 to 1.0).
   */
  public static cosineSimilarity(a: string, b: string): number {
    const vecA = this.embed(a);
    const vecB = this.embed(b);

    let dotProduct = 0;
    for (const [gram, valA] of vecA.entries()) {
      const valB = vecB.get(gram);
      if (valB) {
        dotProduct += valA * valB;
      }
    }

    return Math.min(1.0, Math.max(0.0, dotProduct));
  }

  /**
   * Search top-K items ranked by cosine similarity against query.
   */
  public static searchTopK<T>(
    query: string,
    items: T[],
    textSelector: (item: T) => string,
    topK: number = 3,
    minThreshold: number = 0.15
  ): Array<{ item: T; score: number }> {
    const scored = items.map((item) => {
      const text = textSelector(item);
      const score = this.cosineSimilarity(query, text);
      return { item, score };
    });

    return scored
      .filter((s) => s.score >= minThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
