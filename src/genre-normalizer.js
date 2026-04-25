/**
 * Maps raw genre tags to normalized playlist categories.
 * Rules are passed in from genre-map.json at construction time.
 */

export class GenreNormalizer {
  constructor(rules) {
    this._compiled = rules.map((rule) => ({
      genre:    rule.genre,
      keywords: rule.keywords.map((k) => k.toLowerCase()),
    }));
  }

  normalize(tags) {
    if (!tags || tags.length === 0) return 'Otros';

    const votes = {};
    for (const raw of tags) {
      const matched = this._matchOne(raw.toLowerCase());
      if (matched) votes[matched] = (votes[matched] || 0) + 1;
    }

    if (!Object.keys(votes).length) return 'Otros';

    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  }

  _matchOne(lower) {
    for (const rule of this._compiled) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) return rule.genre;
      }
    }
    return null;
  }
}
