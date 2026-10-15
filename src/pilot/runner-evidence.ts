import { constants } from 'node:fs';
import { mkdir, open, realpath, rename, unlink, type FileHandle } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DomainError, requireInput } from '../domain/errors.js';
import { privateOutputPath, privateOutputDirectory } from './private-output.js';

/** Errors may contain RPC requests, key material or database passwords: record only codes. */
export function runnerErrorCode(error: unknown): string {
  return error instanceof DomainError && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)
    ? error.code : 'PILOT_RUNNER_FAILED';
}
export function evidenceProjection(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { code: runnerErrorCode(value) };
  if (Array.isArray(value)) return value.map(evidenceProjection);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key, item]) => !/^(privateKey|signingKey|mnemonic|seed|password|sessionToken|connectionString|databaseUrl|rpcUrl|authorization)$/i.test(key)
      && !(key === 'token' && !(typeof item === 'string' && /^0x[0-9a-f]{40}$/i.test(item))))
    .map(([key, item]) => [key, evidenceProjection(item)]));
  return value;
}
export interface RunnerEvidence {
  append(stage: string, data: unknown): Promise<void>;
  save(name: string, data: unknown): Promise<void>;
  load<T>(name: string): Promise<T | null>;
}
const artifactNames = new Set(['timeline.jsonl', 'runner.lock', 'configuration.json', 'diagnostics.json', 'manual-records-evidence.json',
  'allowance.json', 'allowance-result.json', 'trade-review.json', 'run-state.json', 'database-evidence.json',
  'accounting-before-restart.json', 'accounting-after-restart.json', 'summary.json']);
export function requireDistinctEvidenceInputs(directory: string, inputs: readonly (string | undefined)[]): void {
  const reserved = new Set([...artifactNames].map(name => resolve(directory, name)));
  requireInput(inputs.every(path => path === undefined || !reserved.has(resolve(path))), 'EVIDENCE_INPUT_COLLISION',
    'Configuration, records and key files must not occupy a managed evidence filename.');
}

/** fsync before sending; private directory, no-follow files and an exclusive operator lock. */
export class PilotEvidence implements RunnerEvidence {
  private constructor(readonly directory: string, private readonly lock: FileHandle,
    private readonly timeline: FileHandle) {}
  static async create(path: string): Promise<PilotEvidence> {
    const target = await privateOutputDirectory(resolve(path));
    await mkdir(target, { recursive: true, mode: 0o700 });
    const directory = await realpath(target);
    requireInput(target === directory, 'PRIVATE_OUTPUT_REQUIRED', 'Evidence directory must not traverse symlinks.');
    await privateOutputPath(join(directory, 'timeline.jsonl'));
    const dir = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await dir.stat();
      requireInput(stat.isDirectory() && (stat.mode & 0o077) === 0,
        'PRIVATE_OUTPUT_REQUIRED', 'Evidence directory must have mode 0700.');
    } finally { await dir.close(); }
    let lock: FileHandle;
    try { lock = await open(join(directory, 'runner.lock'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
    catch { throw new DomainError('RUNNER_LOCKED', 'Another runner or an interrupted run owns this directory.'); }
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      await lock.sync();
      const timeline = await open(join(directory, 'timeline.jsonl'), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
      try { const stat = await timeline.stat(); requireInput(stat.isFile() && (stat.mode & 0o077) === 0,
        'PRIVATE_OUTPUT_REQUIRED', 'Timeline must be a private regular file.'); }
      catch (error) { await timeline.close(); throw error; }
      return new PilotEvidence(directory, lock, timeline);
    } catch (error) { await lock.close(); await unlink(join(directory, 'runner.lock')); throw error; }
  }
  async append(stage: string, data: unknown): Promise<void> {
    requireInput(/^[a-z0-9.-]{1,80}$/.test(stage), 'INVALID_EVIDENCE_STAGE', 'Bounded stage required.');
    await this.timeline.writeFile(JSON.stringify({ observedAt: new Date().toISOString(), stage, data: evidenceProjection(data) }) + '\n');
    await this.timeline.sync();
  }
  async save(name: string, data: unknown): Promise<void> {
    requireInput(/^[a-z][a-z0-9-]*\.json$/.test(name), 'INVALID_EVIDENCE_FILE', 'A local JSON filename is required.');
    const temporary = join(this.directory, `${name}.${randomUUID()}.tmp`);
    const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(JSON.stringify(evidenceProjection(data), null, 2) + '\n'); await file.sync(); }
    finally { await file.close(); }
    try { await rename(temporary, join(this.directory, name)); await this.syncDirectory(); }
    catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
  }
  async load<T>(name: string): Promise<T | null> {
    requireInput(/^[a-z][a-z0-9-]*\.json$/.test(name), 'INVALID_EVIDENCE_FILE', 'A local JSON filename is required.');
    let file: FileHandle;
    try { file = await open(join(this.directory, name), constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    try {
      const stat = await file.stat();
      requireInput(stat.isFile() && stat.size <= 16_000_000 && (stat.mode & 0o077) === 0,
        'PRIVATE_OUTPUT_REQUIRED', 'Bounded private regular evidence file required.');
      return JSON.parse(await file.readFile('utf8')) as T;
    } finally { await file.close(); }
  }
  private async syncDirectory(): Promise<void> {
    const file = await open(this.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await file.sync(); } finally { await file.close(); }
  }
  async close(): Promise<void> {
    await this.timeline.close(); await this.lock.close();
    await unlink(join(this.directory, 'runner.lock')); await this.syncDirectory();
  }
}
