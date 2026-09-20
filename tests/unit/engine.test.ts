import { describe, expect, it } from 'vitest';
import {
  compare,
  parseFixture,
  pointerParts,
  type Json,
  type Options,
} from '../../src/engine';
import { baseline, candidate } from '../../src/sample';
const options: Options = {
  ignores: [],
  keyed: false,
  arrayPath: '/records',
  idKey: 'id',
};
const diff = (a: Json, b: Json, extra: Partial<Options> = {}) =>
  compare(a, b, { ...options, ...extra });
describe('bounded strict parser', () => {
  it.each([
    'null',
    'true',
    'false',
    '-1.25e2',
    '"\\u0061"',
    '[]',
    '{}',
    ' {"x": [null, false, 0]}\n',
  ])('agrees with native JSON on %s', (text) =>
    expect(parseFixture(text)).toEqual(JSON.parse(text)),
  );
  it.each([
    '',
    'undefined',
    '[1,]',
    '{"x":1,}',
    '01',
    '+1',
    '1.',
    'NaN',
    'true false',
    '"line\nfeed"',
    '[',
    '{"x" 2}',
    '"\\x"',
  ])('rejects malformed JSON %j', (text) =>
    expect(() => parseFixture(text)).toThrow(),
  );
  it('rejects duplicate escaped-equivalent keys', () =>
    expect(() => parseFixture('{"a":1,"\\u0061":2}')).toThrow('Duplicate'));
  it.each(['9007199254740992', '1e400', '-9007199254740992'])(
    'rejects unsupported number %s',
    (text) => expect(() => parseFixture(text)).toThrow('supported range'),
  );
  it('rejects too many bytes, depth, and nodes', () => {
    expect(() => parseFixture(JSON.stringify('x'.repeat(262144)))).toThrow(
      '256 KiB',
    );
    expect(() => parseFixture('['.repeat(62) + '0' + ']'.repeat(62))).toThrow(
      '60 levels',
    );
    expect(() => parseFixture(JSON.stringify(Array(20000).fill(0)))).toThrow(
      '20,000',
    );
  });
  it('preserves prototype-shaped keys without pollution', () => {
    const value = parseFixture(
      '{"__proto__":{"injected":true},"constructor":2}',
    );
    expect(Object.hasOwn(value as object, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).injected).toBeUndefined();
  });
});
describe('change semantics', () => {
  it('distinguishes null, missing, type and value changes', () => {
    const report = diff(
      { a: null, b: 1, c: 2, d: 3 },
      { a: false, b: '1', c: 4, e: null },
    );
    expect(
      report.changes.map((x) => [x.afterPath ?? x.beforePath, x.kind]),
    ).toEqual([
      ['/a', 'type'],
      ['/b', 'type'],
      ['/c', 'value'],
      ['/d', 'removed'],
      ['/e', 'added'],
    ]);
  });
  it('ignores key order and handles root values', () => {
    expect(diff({ b: 1, a: 2 }, { a: 2, b: 1 }).changes).toEqual([]);
    expect(diff(null, []).changes[0]).toMatchObject({
      kind: 'type',
      beforePath: '',
      afterPath: '',
    });
  });
  it('compares arrays positionally by default', () =>
    expect(diff([1, 2], [2, 1]).changes).toHaveLength(2));
  it('escapes pointer keys', () => {
    expect(
      diff({ 'a/b': { '~': 1 } }, { 'a/b': { '~': 2 } }).changes[0].afterPath,
    ).toBe('/a~1b/~0');
    expect(pointerParts('/a~1b/~0/~01/')).toEqual(['a/b', '~', '~1', '']);
  });
  it.each(['records', '#/records', '/a~2b', '/~'])(
    'rejects invalid pointer %s',
    (p) => expect(() => pointerParts(p)).toThrow(),
  );
  it('excludes exact subtrees and reports unused rules', () => {
    const report = diff(
      { a: { x: 1 }, b: 2 },
      { a: { x: 3 }, b: 4 },
      { ignores: ['/a', '/missing', '/a'] },
    );
    expect(report.changes.map((x) => x.afterPath)).toEqual(['/b']);
    expect(report.ignoredPaths).toEqual(['/a']);
    expect(report.unmatchedIgnores).toEqual(['/missing']);
  });
  it('flags descendants not traversed after parent replacement and never exports their contents', () => {
    const report = diff(
      { a: { secret: 'example' } },
      { a: [] },
      { ignores: ['/a/secret'] },
    );
    expect(report.unmatchedIgnores).toEqual(['/a/secret']);
    expect(report.changes[0].before).toEqual({ type: 'object', size: 1 });
  });
  it('rejects root exclusion and excessive changes', () => {
    expect(() => diff(1, 2, { ignores: [''] })).toThrow('entire document');
    expect(() => diff(Array(5001).fill(1), Array(5001).fill(2))).toThrow(
      '5,000',
    );
  });
  it('does not confuse inherited keys with existing properties', () =>
    expect(diff({}, { toString: 1 }).changes[0].kind).toBe('added'));
  it('matches independent flat-object oracle for 100 deterministic cases', () => {
    for (let seed = 0; seed < 100; seed++) {
      const a: Record<string, Json> = {},
        b: Record<string, Json> = {};
      for (let key = 0; key < 20; key++) {
        if ((seed + key) % 3 !== 0) a[`f${key}`] = (seed * 7 + key) % 11;
        if ((seed + key) % 5 !== 0) b[`f${key}`] = (seed * 3 + key) % 11;
      }
      const expected = [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter((k) => a[k] !== b[k])
        .sort();
      expect(
        diff(a, b).changes.map((x) => (x.afterPath ?? x.beforePath)!.slice(1)),
      ).toEqual(expected);
      expect(diff(a, a).changes).toEqual([]);
      expect(diff(a, b).changes).toHaveLength(diff(b, a).changes.length);
    }
  });
});
describe('identity-aware arrays', () => {
  it('compares sample records without reorder noise', () => {
    const report = diff(baseline, candidate, {
      keyed: true,
      ignores: ['/generatedAt'],
    });
    expect(report.changes).toHaveLength(4);
    expect(report.reorderedRecords).toBe(2);
    expect(report.changes.find((x) => x.kind === 'type')).toMatchObject({
      beforePath: '/records/0/weightKg',
      afterPath: '/records/1/weightKg',
    });
  });
  it('preserves numeric vs string identity and supports root arrays', () => {
    expect(
      diff([{ id: 1 }, { id: '1' }], [{ id: '1' }, { id: 1 }], {
        keyed: true,
        arrayPath: '',
      }),
    ).toMatchObject({ changes: [], reorderedRecords: 2 });
  });
  it.each([
    { records: [{ id: 'a' }, { id: 'a' }] },
    { records: [{ id: null }] },
    { records: [{ wrong: 1 }] },
    { records: [2] },
  ])('rejects ambiguous records %j', ({ records }) =>
    expect(() => diff({ records }, { records }, { keyed: true })).toThrow(),
  );
  it('rejects missing arrays, inherited IDs, empty IDs fields, and overlapping exclusions', () => {
    expect(() => diff({}, {}, { keyed: true })).toThrow('array');
    expect(() =>
      diff(
        { records: [{}] },
        { records: [] },
        { keyed: true, idKey: 'constructor' },
      ),
    ).toThrow('ID field');
    expect(() =>
      diff({ records: [] }, { records: [] }, { keyed: true, idKey: '' }),
    ).toThrow('ID field');
    for (const path of ['/records', '/records/0/status'])
      expect(() =>
        diff(baseline, candidate, { keyed: true, ignores: [path] }),
      ).toThrow('overlap');
  });
  it('does not mutate either fixture', () => {
    const a = JSON.stringify(baseline),
      b = JSON.stringify(candidate);
    diff(baseline, candidate, { keyed: true });
    expect(JSON.stringify(baseline)).toBe(a);
    expect(JSON.stringify(candidate)).toBe(b);
  });
});
