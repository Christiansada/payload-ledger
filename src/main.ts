import './style.css';
import {
  compare,
  parseFixture,
  limits,
  type Report,
  type ValueSummary,
} from './engine';
import { baseline, candidate } from './sample';
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const left = get<HTMLTextAreaElement>('baseline'),
  right = get<HTMLTextAreaElement>('candidate');
const keyed = get<HTMLInputElement>('keyed'),
  arrayPath = get<HTMLInputElement>('array-path'),
  idKey = get<HTMLInputElement>('id-key'),
  ignores = get<HTMLTextAreaElement>('ignores');
const error = get('error'),
  state = get('state'),
  exportButton = get<HTMLButtonElement>('export');
let report: Report | undefined;
let revision = 0;
const clearError = () => {
  error.hidden = true;
  error.textContent = '';
};
function invalidate() {
  revision++;
  report = undefined;
  exportButton.disabled = true;
  clearError();
  state.textContent = 'Inputs changed. Compare fixtures to refresh the review.';
  get('summary').replaceChildren();
  get('notes').textContent = '';
  get('count').textContent = '';
  get('results').replaceChildren(
    element('div', 'Review needs a new comparison.', 'empty'),
  );
}
function element(tag: string, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
function fail(message: string) {
  error.textContent = message;
  error.hidden = false;
}
const labels = {
  added: 'Added',
  removed: 'Removed',
  type: 'Type changed',
  value: 'Value changed',
};
function valueText(summary: ValueSummary) {
  return summary.type === 'missing'
    ? '—'
    : summary.size !== undefined
      ? `${summary.type} · ${summary.size} ${summary.type === 'array' ? 'items' : 'keys'}`
      : JSON.stringify(summary.value);
}
function render() {
  if (!report) return;
  const type = get<HTMLSelectElement>('kind').value,
    query = get<HTMLInputElement>('search').value.toLowerCase();
  const changes = report.changes.filter(
    (c) =>
      (type === 'all' || c.kind === type) &&
      `${c.beforePath ?? ''} ${c.afterPath ?? ''}`
        .toLowerCase()
        .includes(query),
  );
  get('count').textContent =
    `${changes.length} of ${report.changes.length} changes`;
  const result = get('results');
  result.replaceChildren();
  if (!changes.length) {
    const empty = element('div', '', 'empty');
    empty.append(
      element(
        'h3',
        report.changes.length
          ? 'No changes match these filters.'
          : 'No differences under these rules.',
      ),
      element(
        'p',
        report.changes.length
          ? 'Clear the path filter or select all change types.'
          : 'Review the exclusions and matching rules before drawing conclusions.',
      ),
    );
    result.append(empty);
    return;
  }
  // Bound DOM work; the export always includes every change.
  for (const change of changes.slice(0, 250)) {
    const row = element('article', '', 'change');
    const heading = element('div', '', 'change-head');
    heading.append(
      element('span', labels[change.kind], `badge ${change.kind}`),
    );
    const path = change.afterPath ?? change.beforePath ?? '';
    heading.append(element('code', path === '' ? '(root)' : path));
    row.append(heading);
    if (
      change.beforePath !== null &&
      change.afterPath !== null &&
      change.beforePath !== change.afterPath
    )
      row.append(
        element(
          'p',
          `Baseline: ${change.beforePath || '(root)'} → Candidate: ${change.afterPath || '(root)'}`,
          'hint',
        ),
      );
    const values = element('div', '', 'values');
    for (const [label, summary] of [
      ['Before', change.before],
      ['After', change.after],
    ] as const) {
      const cell = element('div');
      cell.append(
        element('span', `${label} / ${summary.type}`, 'value-label'),
        element('pre', valueText(summary)),
      );
      values.append(cell);
    }
    row.append(values);
    result.append(row);
  }
  if (changes.length > 250)
    result.append(
      element(
        'p',
        'Showing the first 250 matching changes. Narrow the filters or export the complete review.',
        'hint',
      ),
    );
}
function run() {
  clearError();
  report = undefined;
  exportButton.disabled = true;
  get('results').replaceChildren();
  get('summary').replaceChildren();
  get('notes').textContent = '';
  get('count').textContent = '';
  try {
    let a, b;
    try {
      a = parseFixture(left.value);
    } catch (e) {
      throw new Error(`Baseline: ${(e as Error).message}`);
    }
    try {
      b = parseFixture(right.value);
    } catch (e) {
      throw new Error(`Candidate: ${(e as Error).message}`);
    }
    report = compare(a, b, {
      keyed: keyed.checked,
      arrayPath: arrayPath.value,
      idKey: idKey.value,
      ignores: ignores.value.split(/\r?\n/).filter((x) => x !== ''),
    });
    const stats = get('summary');
    for (const [key, label] of Object.entries(labels)) {
      const stat = element('div', '', 'stat');
      stat.append(
        element(
          'strong',
          String(report.changes.filter((x) => x.kind === key).length),
        ),
        element('span', label),
      );
      stats.append(stat);
    }
    get('notes').textContent =
      `${report.reorderedRecords} matched records changed index · ${report.ignoredPaths.length} exclusion paths visited.${report.unmatchedIgnores.length ? ` Exclusions not visited: ${report.unmatchedIgnores.join(', ')}. A parent change or exclusion can prevent traversal.` : ''}`;
    state.textContent = `Comparison complete: ${report.changes.length} changes. Exports include all changes, regardless of filters.`;
    exportButton.disabled = false;
    render();
  } catch (e) {
    fail((e as Error).message);
    state.textContent =
      'Comparison failed. Correct the inputs or rules and try again.';
  }
}
for (const control of [left, right, keyed, arrayPath, idKey, ignores])
  control.addEventListener('input', invalidate);
function setMatchingState() {
  arrayPath.disabled = !keyed.checked;
  idKey.disabled = !keyed.checked;
}
keyed.addEventListener('change', setMatchingState);
setMatchingState();
get('compare').addEventListener('click', run);
get('sample').addEventListener('click', () => {
  invalidate();
  left.value = JSON.stringify(baseline, null, 2);
  right.value = JSON.stringify(candidate, null, 2);
  keyed.checked = true;
  arrayPath.value = '/records';
  idKey.value = 'id';
  ignores.value = '/generatedAt';
  setMatchingState();
  get<HTMLSelectElement>('kind').value = 'all';
  get<HTMLInputElement>('search').value = '';
  run();
});
get('clear').addEventListener('click', () => {
  invalidate();
  left.value = '';
  right.value = '';
  ignores.value = '';
  keyed.checked = false;
  setMatchingState();
  for (const id of ['baseline-file', 'candidate-file'])
    get<HTMLInputElement>(id).value = '';
  state.textContent = 'Workspace cleared. Enter two fixtures to begin.';
  left.focus();
});
for (const id of ['kind', 'search']) get(id).addEventListener('input', render);
for (const [id, target] of [
  ['baseline-file', left],
  ['candidate-file', right],
] as const) {
  get<HTMLInputElement>(id).addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    invalidate();
    const atRevision = revision;
    try {
      if (file.size > limits.bytes) throw new Error('File exceeds 256 KiB.');
      const text = await file.text();
      if (revision !== atRevision) return;
      parseFixture(text);
      target.value = text;
      state.textContent =
        'File loaded. Compare fixtures to refresh the review.';
    } catch (e) {
      if (revision === atRevision)
        fail(
          `${id.startsWith('baseline') ? 'Baseline' : 'Candidate'} file: ${(e as Error).message} Existing input was preserved.`,
        );
    } finally {
      input.value = '';
    }
  });
}
exportButton.addEventListener('click', () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'payload-ledger-review.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
