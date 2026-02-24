/**
 * Model Matching Tests
 *
 * Tests the normalizeName, tokenize, jaccardSimilarity, and resolveModelSlug
 * functions to ensure model names from external sources match correctly.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  tokenize,
  jaccardSimilarity,
  resolveModelSlug,
  type MatchContext,
} from '../lib/model-matching'

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Claude-Opus-4.5  ')).toBe('claude opus 45')
  })

  it('removes provider prefixes', () => {
    expect(normalizeName('anthropic/claude-opus-4.5')).toBe('claude opus 45')
    expect(normalizeName('openai/gpt-4o')).toBe('gpt 4o')
    expect(normalizeName('meta-llama/llama-3.3-70b')).toBe('llama 33')
  })

  it('unifies version separators', () => {
    expect(normalizeName('gpt-4.5')).toBe('gpt 45')
    expect(normalizeName('claude-4-5-sonnet')).toBe('claude 45 sonnet')
  })

  it('removes parenthetical content', () => {
    expect(normalizeName('GPT-4o (Nov 2024)')).toBe('gpt 4o')
    expect(normalizeName('o1 (extra high)')).toBe('o1')
  })

  it('strips variant suffixes', () => {
    expect(normalizeName('deepseek-r1-reasoning')).toBe('deepseek r1')
    expect(normalizeName('gemini-2.5-pro-preview')).toBe('gemini 25 pro')
    expect(normalizeName('claude-3.5-haiku-instruct')).toBe('claude 35 haiku')
  })

  it('strips compound variant suffixes', () => {
    expect(normalizeName('claude-opus-4-1-thinking-16k')).toBe('claude opus 41')
    expect(normalizeName('gpt-5-so-true')).toBe('gpt 5')
    expect(normalizeName('grok-3-beta')).toBe('grok 3')
  })

  it('strips multiple variant suffixes in sequence', () => {
    // -instruct stripped first, then -preview would be stripped if present
    expect(normalizeName('llama-4-maverick-instruct')).toBe('llama 4 maverick')
  })

  it('strips date suffixes', () => {
    expect(normalizeName('gpt-4o-20241101')).toBe('gpt 4o')
    expect(normalizeName('claude-3-opus-2025-01-15')).toBe('claude 3 opus')
  })

  it('strips short date suffixes (MM-DD)', () => {
    expect(normalizeName('grok-3-02-24')).toBe('grok 3')
  })

  it('strips model parameter suffixes (17b-128e)', () => {
    expect(normalizeName('llama-4-maverick-17b-128e')).toBe('llama 4 maverick')
    expect(normalizeName('qwen-2.5-72b')).toBe('qwen 25')
  })
})

describe('tokenize', () => {
  it('produces correct token sets', () => {
    const tokens = tokenize('Claude Opus 4.5')
    expect(tokens).toEqual(new Set(['claude', 'opus', '45']))
  })
})

describe('jaccardSimilarity', () => {
  it('returns 1 for identical sets', () => {
    const a = new Set(['claude', 'opus', '45'])
    expect(jaccardSimilarity(a, a)).toBe(1)
  })

  it('returns 0 for disjoint sets', () => {
    const a = new Set(['claude', 'opus'])
    const b = new Set(['gpt', '4o'])
    expect(jaccardSimilarity(a, b)).toBe(0)
  })

  it('returns correct similarity for overlapping sets', () => {
    const a = new Set(['claude', 'opus', '45'])
    const b = new Set(['claude', 'opus', '4'])
    // intersection=2, union=4, jaccard=0.5
    expect(jaccardSimilarity(a, b)).toBe(0.5)
  })
})

describe('resolveModelSlug', () => {
  const mockCtx: MatchContext = {
    dbMappings: new Map([
      ['claude-opus-4-5', 'claude-opus-45'],
      ['gpt-5-2', 'gpt-52'],
    ]),
    dbSlugs: new Set([
      'claude-opus-45',
      'claude-sonnet-45',
      'gpt-4o',
      'gpt-52',
      'deepseek-v3',
      'deepseek-r1',
      'gemini-25-pro',
    ]),
    normalizedDbSlugs: new Map([
      ['claude opus 45', 'claude-opus-45'],
      ['claude sonnet 45', 'claude-sonnet-45'],
      ['gpt 4o', 'gpt-4o'],
      ['gpt 52', 'gpt-52'],
      ['deepseek v3', 'deepseek-v3'],
      ['deepseek r1', 'deepseek-r1'],
      ['gemini 25 pro', 'gemini-25-pro'],
    ]),
  }

  it('matches via DB mappings (priority 1)', () => {
    expect(resolveModelSlug('claude-opus-4-5', mockCtx)).toBe('claude-opus-45')
    expect(resolveModelSlug('gpt-5-2', mockCtx)).toBe('gpt-52')
  })

  it('matches via exact slug (priority 2)', () => {
    expect(resolveModelSlug('gpt-4o', mockCtx)).toBe('gpt-4o')
    expect(resolveModelSlug('deepseek-v3', mockCtx)).toBe('deepseek-v3')
  })

  it('matches via normalized name (priority 3)', () => {
    // "Claude Opus 4.5" normalizes to "claude opus 45"
    expect(resolveModelSlug('Claude Opus 4.5', mockCtx)).toBe('claude-opus-45')
    // Provider prefix stripped
    expect(resolveModelSlug('anthropic/claude-sonnet-4.5', mockCtx)).toBe('claude-sonnet-45')
  })

  it('matches via fuzzy match (priority 4)', () => {
    // "deepseek-v3-reasoning" strips -reasoning → "deepseek v3" → exact normalized match
    expect(resolveModelSlug('deepseek-v3-reasoning', mockCtx)).toBe('deepseek-v3')
  })

  it('returns null for unmatched models', () => {
    expect(resolveModelSlug('totally-unknown-model', mockCtx)).toBeNull()
  })
})
