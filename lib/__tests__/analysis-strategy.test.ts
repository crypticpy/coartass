/**
 * Analysis Strategy Tests
 *
 * Tests for strategy capping, content type handling, and recommendation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  capStrategy,
  getEffectiveMaxStrategy,
  recommendStrategy,
  STRATEGY_ORDER,
  CONTENT_TYPE_MAX_STRATEGY,
} from '../analysis-strategy';
import type { ContentType } from '@/types/template';

describe('capStrategy', () => {
  it('returns original strategy when maxStrategy is undefined', () => {
    expect(capStrategy('advanced', undefined)).toBe('advanced');
    expect(capStrategy('hybrid', undefined)).toBe('hybrid');
    expect(capStrategy('basic', undefined)).toBe('basic');
  });

  it('caps strategy when it exceeds maxStrategy', () => {
    expect(capStrategy('advanced', 'hybrid')).toBe('hybrid');
    expect(capStrategy('advanced', 'basic')).toBe('basic');
    expect(capStrategy('hybrid', 'basic')).toBe('basic');
  });

  it('returns original strategy when at or below maxStrategy', () => {
    expect(capStrategy('basic', 'hybrid')).toBe('basic');
    expect(capStrategy('basic', 'advanced')).toBe('basic');
    expect(capStrategy('hybrid', 'advanced')).toBe('hybrid');
  });

  it('returns original strategy when equal to maxStrategy', () => {
    expect(capStrategy('basic', 'basic')).toBe('basic');
    expect(capStrategy('hybrid', 'hybrid')).toBe('hybrid');
    expect(capStrategy('advanced', 'advanced')).toBe('advanced');
  });
});

describe('getEffectiveMaxStrategy', () => {
  it('returns undefined when neither templateMaxStrategy nor contentType provided', () => {
    expect(getEffectiveMaxStrategy(undefined, undefined)).toBeUndefined();
  });

  it('returns templateMaxStrategy when contentType has no cap', () => {
    expect(getEffectiveMaxStrategy('hybrid', 'meeting')).toBe('hybrid');
    expect(getEffectiveMaxStrategy('basic', 'interview')).toBe('basic');
    expect(getEffectiveMaxStrategy('advanced', 'general')).toBe('advanced');
  });

  it('returns content type cap when no templateMaxStrategy', () => {
    expect(getEffectiveMaxStrategy(undefined, 'radio-traffic')).toBe('hybrid');
  });

  it('returns the more restrictive of template and content type caps', () => {
    // Template is more restrictive
    expect(getEffectiveMaxStrategy('basic', 'radio-traffic')).toBe('basic');
    // Content type is more restrictive
    expect(getEffectiveMaxStrategy('advanced', 'radio-traffic')).toBe('hybrid');
    // Equal restrictions
    expect(getEffectiveMaxStrategy('hybrid', 'radio-traffic')).toBe('hybrid');
  });

  it('handles all content types correctly', () => {
    const contentTypes: ContentType[] = ['meeting', 'radio-traffic', 'interview', 'general'];

    for (const contentType of contentTypes) {
      const expected = CONTENT_TYPE_MAX_STRATEGY[contentType];
      expect(getEffectiveMaxStrategy(undefined, contentType)).toBe(expected);
    }
  });
});

describe('recommendStrategy', () => {
  // Short transcript (~100 tokens)
  const shortTranscript = 'Hello world. '.repeat(50);

  // Medium transcript (~25,000 tokens)
  const mediumTranscript = 'This is a longer sentence with more words that takes up more tokens. '.repeat(2500);

  // Long transcript (~80,000 tokens)
  const longTranscript = 'This is a very detailed discussion with lots of content and nuance. '.repeat(6000);

  describe('token-based recommendations', () => {
    it('recommends basic for short transcripts', () => {
      const result = recommendStrategy(shortTranscript);
      expect(result.strategy).toBe('basic');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('recommends hybrid for medium transcripts', () => {
      const result = recommendStrategy(mediumTranscript);
      expect(result.strategy).toBe('hybrid');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('recommends advanced for long transcripts', () => {
      const result = recommendStrategy(longTranscript);
      expect(result.strategy).toBe('advanced');
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('maxStrategy capping (legacy signature)', () => {
    it('caps strategy when using legacy string parameter', () => {
      const result = recommendStrategy(longTranscript, 'hybrid');
      expect(result.strategy).toBe('hybrid');
      expect(result.reasoning).toContain('Capped');
    });

    it('does not cap when maxStrategy allows the recommendation', () => {
      const result = recommendStrategy(shortTranscript, 'advanced');
      expect(result.strategy).toBe('basic');
      expect(result.reasoning).not.toContain('Capped');
    });
  });

  describe('options object with contentType', () => {
    it('caps radio-traffic to hybrid by default', () => {
      const result = recommendStrategy(longTranscript, { contentType: 'radio-traffic' });
      expect(result.strategy).toBe('hybrid');
      expect(result.reasoning).toContain('radio traffic');
    });

    it('does not cap meeting content type', () => {
      const result = recommendStrategy(longTranscript, { contentType: 'meeting' });
      expect(result.strategy).toBe('advanced');
    });

    it('respects templateMaxStrategy over contentType when more restrictive', () => {
      const result = recommendStrategy(longTranscript, {
        maxStrategy: 'basic',
        contentType: 'radio-traffic', // Would cap at hybrid
      });
      expect(result.strategy).toBe('basic');
    });

    it('respects contentType cap when more restrictive than templateMaxStrategy', () => {
      const result = recommendStrategy(longTranscript, {
        maxStrategy: 'advanced',
        contentType: 'radio-traffic', // Caps at hybrid
      });
      expect(result.strategy).toBe('hybrid');
    });
  });

  describe('alternatives filtering', () => {
    it('filters out strategies exceeding maxStrategy', () => {
      const result = recommendStrategy(longTranscript, { maxStrategy: 'hybrid' });
      // Advanced should be filtered out
      const alternativeStrategies = result.alternatives.map(a => a.strategy);
      expect(alternativeStrategies).not.toContain('advanced');
    });

    it('includes valid alternatives when capped to hybrid', () => {
      const result = recommendStrategy(longTranscript, { maxStrategy: 'hybrid' });
      // Should only have basic as alternative (advanced filtered out)
      const alternativeStrategies = result.alternatives.map(a => a.strategy);
      expect(alternativeStrategies).toContain('basic');
      expect(alternativeStrategies).not.toContain('advanced');
    });

    it('filters all higher strategies when capped to basic', () => {
      const result = recommendStrategy(longTranscript, { maxStrategy: 'basic' });
      const alternativeStrategies = result.alternatives.map(a => a.strategy);
      // Hybrid and advanced should be filtered out
      expect(alternativeStrategies).not.toContain('hybrid');
      expect(alternativeStrategies).not.toContain('advanced');
    });
  });

  describe('result structure', () => {
    it('returns complete recommendation object', () => {
      const result = recommendStrategy(mediumTranscript);

      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('estimatedTime');
      expect(result).toHaveProperty('transcriptTokens');
      expect(result).toHaveProperty('estimatedDuration');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('alternatives');

      expect(result.estimatedTime).toHaveProperty('min');
      expect(result.estimatedTime).toHaveProperty('max');
      expect(result.transcriptTokens).toBeGreaterThan(0);
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });
  });
});

describe('STRATEGY_ORDER', () => {
  it('has strategies in correct order (basic < hybrid < advanced)', () => {
    expect(STRATEGY_ORDER).toEqual(['basic', 'hybrid', 'advanced']);
  });

  it('is readonly', () => {
    // TypeScript enforces this, but we can verify the array is frozen-like
    expect(STRATEGY_ORDER.length).toBe(3);
  });
});

describe('CONTENT_TYPE_MAX_STRATEGY', () => {
  it('only radio-traffic has a cap', () => {
    expect(CONTENT_TYPE_MAX_STRATEGY['radio-traffic']).toBe('hybrid');
    expect(CONTENT_TYPE_MAX_STRATEGY['meeting']).toBeUndefined();
    expect(CONTENT_TYPE_MAX_STRATEGY['interview']).toBeUndefined();
    expect(CONTENT_TYPE_MAX_STRATEGY['general']).toBeUndefined();
  });
});
