export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export const limits = { bytes: 262144, depth: 60, nodes: 20000, changes: 5000 };

/** Bounded JSON parser: duplicate keys and unsafe integral values are rejected. */
export function parseFixture(text: string): Json {
  if (new TextEncoder().encode(text).length > limits.bytes)
    throw new Error('Input exceeds 256 KiB.');
  let i = 0,
    nodes = 0;
  const fail = (message: string): never => {
    throw new Error(`${message} At character ${i + 1}.`);
  };
  const ws = () => {
    while (/[\x20\t\r\n]/.test(text[i] ?? '\0')) i++;
  };
  const string = (): string => {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '\\') {
        i += 2;
        continue;
      }
      if (text[i++] === '"') {
        try {
          return JSON.parse(text.slice(start, i)) as string;
        } catch {
          return fail('Invalid string.');
        }
      }
    }
    return fail('Unterminated string.');
  };
  const value = (depth: number): Json => {
    if (depth > limits.depth) return fail('Nesting exceeds 60 levels.');
    if (++nodes > limits.nodes) return fail('Input exceeds 20,000 values.');
    ws();
    if (text[i] === '"') return string();
    if (text[i] === '{') {
      i++;
      ws();
      const result: Record<string, Json> = Object.create(null) as Record<
        string,
        Json
      >;
      if (text[i] === '}') {
        i++;
        return result;
      }
      while (i < text.length) {
        if (text[i] !== '"') return fail('Expected an object key.');
        const key = string();
        ws();
        if (Object.hasOwn(result, key)) return fail('Duplicate object key.');
        if (text[i++] !== ':') return fail('Expected a colon.');
        result[key] = value(depth + 1);
        ws();
        if (text[i] === '}') {
          i++;
          return result;
        }
        if (text[i++] !== ',') return fail('Expected a comma.');
        ws();
      }
      return fail('Unterminated object.');
    }
    if (text[i] === '[') {
      i++;
      ws();
      const result: Json[] = [];
      if (text[i] === ']') {
        i++;
        return result;
      }
      while (i < text.length) {
        result.push(value(depth + 1));
        ws();
        if (text[i] === ']') {
          i++;
          return result;
        }
        if (text[i++] !== ',') return fail('Expected a comma.');
        ws();
      }
      return fail('Unterminated array.');
    }
    for (const [token, parsed] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (text.startsWith(token, i)) {
        i += token.length;
        return parsed;
      }
    }
    const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      text.slice(i),
    )?.[0];
    if (!token) return fail('Expected a JSON value.');
    i += token.length;
    const number = Number(token);
    if (
      !Number.isFinite(number) ||
      (Number.isInteger(number) && !Number.isSafeInteger(number))
    )
      return fail(
        'Number is outside the supported range; encode large IDs as strings.',
      );
    return number;
  };
  const result = value(0);
  ws();
  if (i !== text.length) return fail('Unexpected trailing content.');
  return result;
}

export function pointerParts(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/') || /~(?![01])/.test(pointer))
    throw new Error(
      'Use JSON Pointers beginning with /; escape ~ as ~0 and / as ~1.',
    );
  return pointer
    .slice(1)
    .split('/')
    .map((x) => x.replace(/~1/g, '/').replace(/~0/g, '~'));
}
const child = (path: string, key: string | number) =>
  `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
function resolve(value: Json, pointer: string): Json | undefined {
  let current: Json | undefined = value;
  for (const part of pointerParts(pointer)) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !Object.hasOwn(current, part)
    )
      return undefined;
    if (Array.isArray(current) && !/^(0|[1-9]\d*)$/.test(part))
      return undefined;
    current = (current as Record<string, Json>)[part];
  }
  return current;
}
export const kind = (value: Json | undefined): string =>
  value === undefined
    ? 'missing'
    : value === null
      ? 'null'
      : Array.isArray(value)
        ? 'array'
        : typeof value;
export interface ValueSummary {
  type: string;
  value?: null | boolean | number | string;
  size?: number;
}
function summarize(value: Json | undefined): ValueSummary {
  if (value === undefined) return { type: 'missing' };
  if (value !== null && typeof value === 'object')
    return { type: kind(value), size: Object.keys(value).length };
  return { type: kind(value), value };
}
export type ChangeKind = 'added' | 'removed' | 'type' | 'value';
export interface Change {
  kind: ChangeKind;
  beforePath: string | null;
  afterPath: string | null;
  before: ValueSummary;
  after: ValueSummary;
}
export interface Options {
  ignores: string[];
  keyed: boolean;
  arrayPath: string;
  idKey: string;
}
export interface Report {
  version: 1;
  options: Options;
  changes: Change[];
  ignoredPaths: string[];
  unmatchedIgnores: string[];
  reorderedRecords: number;
}

/** Inputs must come from parseFixture. Reports are review summaries, not patches. */
export function compare(before: Json, after: Json, options: Options): Report {
  const ignores = [...new Set(options.ignores)];
  if (ignores.length > 100)
    throw new Error('Use at most 100 exclusion pointers.');
  for (const path of ignores) {
    pointerParts(path);
    if (path === '')
      throw new Error('Excluding the entire document is not supported.');
  }
  const report: Report = {
    version: 1,
    options: { ...options, ignores },
    changes: [],
    ignoredPaths: [],
    unmatchedIgnores: [],
    reorderedRecords: 0,
  };
  let leftIndex: Map<string, { value: Json; index: number }> | undefined;
  let rightIndex: Map<string, { value: Json; index: number }> | undefined;
  if (options.keyed) {
    pointerParts(options.arrayPath);
    if (!options.idKey) throw new Error('Enter an ID field name.');
    if (
      ignores.some(
        (p) =>
          p === options.arrayPath ||
          options.arrayPath.startsWith(`${p}/`) ||
          p.startsWith(`${options.arrayPath}/`),
      )
    )
      throw new Error(
        'Exclusions cannot overlap the matched array; use positional mode to exclude array fields.',
      );
    const index = (root: Json, label: string) => {
      const array = resolve(root, options.arrayPath);
      if (!Array.isArray(array))
        throw new Error(
          `${label}: the matched pointer must resolve to an array.`,
        );
      const map = new Map<string, { value: Json; index: number }>();
      array.forEach((item, position) => {
        if (
          item === null ||
          Array.isArray(item) ||
          typeof item !== 'object' ||
          !Object.hasOwn(item, options.idKey)
        )
          throw new Error(`${label}: every matched record needs an ID field.`);
        const id = item[options.idKey];
        if (typeof id !== 'string' && typeof id !== 'number')
          throw new Error(`${label}: IDs must be strings or numbers.`);
        const key = `${typeof id}:${JSON.stringify(id)}`;
        if (map.has(key))
          throw new Error(
            `${label}: duplicate record ID at index ${position}.`,
          );
        map.set(key, { value: item, index: position });
      });
      return map;
    };
    leftIndex = index(before, 'Baseline');
    rightIndex = index(after, 'Candidate');
  }
  const visited = new Set<string>();
  const walk = (
    a: Json | undefined,
    b: Json | undefined,
    ap: string,
    bp: string,
  ) => {
    if (ignores.includes(ap) || ignores.includes(bp)) {
      visited.add(ignores.includes(ap) ? ap : bp);
      return;
    }
    const ak = kind(a),
      bk = kind(b);
    if (
      a === undefined ||
      b === undefined ||
      ak !== bk ||
      (ak !== 'object' && ak !== 'array')
    ) {
      if (a === b) return;
      if (report.changes.length >= limits.changes)
        throw new Error(
          'More than 5,000 changes. Narrow the fixtures before comparing.',
        );
      report.changes.push({
        kind:
          a === undefined
            ? 'added'
            : b === undefined
              ? 'removed'
              : ak !== bk
                ? 'type'
                : 'value',
        beforePath: a === undefined ? null : ap,
        afterPath: b === undefined ? null : bp,
        before: summarize(a),
        after: summarize(b),
      });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (
        options.keyed &&
        ap === options.arrayPath &&
        leftIndex &&
        rightIndex
      ) {
        for (const key of new Set([
          ...leftIndex.keys(),
          ...rightIndex.keys(),
        ])) {
          const av = leftIndex.get(key),
            bv = rightIndex.get(key);
          if (av && bv && av.index !== bv.index) report.reorderedRecords++;
          walk(
            av?.value,
            bv?.value,
            child(ap, av?.index ?? bv!.index),
            child(bp, bv?.index ?? av!.index),
          );
        }
      } else
        for (let i = 0; i < Math.max(a.length, b.length); i++)
          walk(a[i], b[i], child(ap, i), child(bp, i));
    } else {
      const ao = a as Record<string, Json>,
        bo = b as Record<string, Json>;
      for (const key of [
        ...new Set([...Object.keys(ao), ...Object.keys(bo)]),
      ].sort())
        walk(
          Object.hasOwn(ao, key) ? ao[key] : undefined,
          Object.hasOwn(bo, key) ? bo[key] : undefined,
          child(ap, key),
          child(bp, key),
        );
    }
  };
  walk(before, after, '', '');
  report.ignoredPaths = [...visited].sort();
  report.unmatchedIgnores = ignores.filter((path) => !visited.has(path));
  return report;
}
