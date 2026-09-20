export const baseline = {
  batch: 'synthetic-example',
  generatedAt: '2026-01-01T09:00:00Z',
  records: [
    { id: 'parcel-01', status: 'queued', weightKg: 2.4 },
    { id: 'parcel-02', status: 'in-transit', weightKg: 1.2 },
    { id: 'parcel-03', status: 'queued', weightKg: 0.8 },
  ],
  pagination: { next: null, total: 3 },
};
export const candidate = {
  batch: 'synthetic-example',
  generatedAt: '2026-01-02T09:00:00Z',
  records: [
    { id: 'parcel-02', status: 'delivered', weightKg: 1.2 },
    { id: 'parcel-01', status: 'queued', weightKg: '2.4' },
    { id: 'parcel-04', status: 'queued', weightKg: 3.1 },
  ],
  pagination: { next: null, total: 3 },
};
