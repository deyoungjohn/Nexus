import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { Wallet, type TransactionRequest, type TypedDataDomain, type TypedDataField } from 'ethers';
import { requireInput } from '../domain/errors.js';
import { privateOutputPath } from './private-output.js';

export interface PilotSigner {
  readonly address: string;
  signMessage(message: string): Promise<string>;
  signTypedData(domain: TypedDataDomain, types: Record<string, TypedDataField[]>, value: Record<string, unknown>): Promise<string>;
  signTransaction(transaction: TransactionRequest): Promise<string>;
}
/** Only signing capabilities leave this closure; the wallet/key is never serialized. */
export function privateKeySigner(key: string): PilotSigner {
  requireInput(/^0x[0-9a-f]{64}$/i.test(key.trim()), 'INVALID_PRIVATE_KEY', 'Expected one local EOA private key.');
  let wallet: Wallet;
  try { wallet = new Wallet(key.trim()); }
  catch { throw new Error('Invalid local key'); }
  return Object.freeze({ address: wallet.address.toLowerCase(), signMessage: (m: string) => wallet.signMessage(m),
    signTypedData: (d: TypedDataDomain, t: Record<string, TypedDataField[]>, v: Record<string, unknown>) => wallet.signTypedData(d, t, v),
    signTransaction: (t: TransactionRequest) => wallet.signTransaction(t) });
}
export async function readPrivateKeyFile(path: string): Promise<PilotSigner> {
  const target = await privateOutputPath(path);
  requireInput(target === path, 'PRIVATE_KEY_FILE_UNSAFE', 'Use an absolute private key path without symlinks.');
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    requireInput(stat.isFile() && stat.size <= 100 && (stat.mode & 0o077) === 0,
      'PRIVATE_KEY_FILE_UNSAFE', 'Key must be in a small private regular file, mode 0600.');
    const bytes = await file.readFile();
    try { return privateKeySigner(bytes.toString('utf8')); } finally { bytes.fill(0); }
  } finally { await file.close(); }
}

/** Hidden key entry, and exact per-action confirmations. No piped stdin or --yes path. */
export async function terminalInput(prompt: string, hidden = false): Promise<string> {
  requireInput(process.stdin.isTTY && process.stdout.isTTY, 'INTERACTIVE_TERMINAL_REQUIRED',
    'Use an interactive terminal for private key entry and exact confirmations.');
  process.stdout.write(prompt);
  const input = process.stdin, raw = input.isRaw;
  input.setRawMode(true); input.resume();
  return new Promise<string>((resolve, reject) => {
    let value = '';
    const cleanup = () => { input.off('data', onData); input.off('end', onEnd); input.setRawMode(raw); input.pause(); process.stdout.write('\n'); };
    const onEnd = () => { cleanup(); reject(new Error('Terminal closed')); };
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\u0003' || ch === '\u0004') { cleanup(); reject(new Error('Operator cancelled')); return; }
        if (ch === '\r' || ch === '\n') { cleanup(); resolve(value); return; }
        if (ch === '\u007f' || ch === '\b') { if (value) { value = value.slice(0, -1); if (!hidden) process.stdout.write('\b \b'); } }
        else if (/^[\x20-\x7e]$/.test(ch) && value.length < 1000) { value += ch; if (!hidden) process.stdout.write(ch); }
      }
    };
    input.on('data', onData); input.once('end', onEnd);
  });
}

export type PilotRunnerCommand = 'check' | 'allowance' | 'declaration' | 'run' | 'recover';
export interface PilotRunnerOptions {
  readonly command: PilotRunnerCommand;
  readonly broadcast: boolean;
  readonly keyFile?: string;
  readonly evidenceDirectory?: string;
  readonly signedRecordsOutput?: string;
  readonly waitSeconds: number;
}
export function parsePilotRunnerOptions(args: readonly string[]): PilotRunnerOptions {
  const command = args[0];
  requireInput(['check', 'allowance', 'declaration', 'run', 'recover'].includes(command ?? ''),
    'INVALID_ARGUMENTS', 'Choose check, allowance, declaration, run or recover.');
  const values: Record<string, string> = {};
  let broadcast = false;
  for (let i = 1; i < args.length; i++) {
    const option = args[i]!;
    if (option === '--broadcast') { requireInput(!broadcast, 'INVALID_ARGUMENTS', 'Duplicate flag.'); broadcast = true; continue; }
    requireInput(['--key-file', '--evidence-dir', '--signed-records-output', '--wait-seconds'].includes(option)
      && values[option] === undefined && !!args[i+1] && !args[i+1]!.startsWith('--'), 'INVALID_ARGUMENTS', 'Unknown, duplicate or incomplete option.');
    values[option] = args[++i]!;
  }
  requireInput(!broadcast || command === 'allowance' || command === 'run', 'INVALID_ARGUMENTS', 'Only allowance/run may broadcast.');
  requireInput(!values['--key-file'] || ['allowance', 'declaration', 'run'].includes(command!), 'INVALID_ARGUMENTS', 'Read-only/recovery commands do not need a key.');
  requireInput(command === 'declaration' ? !!values['--signed-records-output'] : !values['--signed-records-output'],
    'INVALID_ARGUMENTS', 'Declaration requires a new private signed-records output.');
  const wait = values['--wait-seconds'] ?? '180';
  requireInput(/^(0|[1-9][0-9]{0,3})$/.test(wait) && Number(wait) <= 3600, 'INVALID_ARGUMENTS', 'Wait must be 0–3600 seconds.');
  return { command: command as PilotRunnerCommand, broadcast, waitSeconds: Number(wait),
    ...(values['--key-file'] ? { keyFile: values['--key-file'] } : {}),
    ...(values['--evidence-dir'] ? { evidenceDirectory: values['--evidence-dir'] } : {}),
    ...(values['--signed-records-output'] ? { signedRecordsOutput: values['--signed-records-output'] } : {}) };
}
