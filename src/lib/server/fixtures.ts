// Recorded Jev calls, bundled into the build so they ship with serverless deploys,
// where the fixtures folder is not on disk at runtime.
const files = import.meta.glob('/fixtures/jev/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const FIXTURES: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(files).map(([path, value]) => [path.split('/').pop()!.replace(/\.json$/, ''), value as Record<string, unknown>])
);
