export class DomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function requireInput(condition: boolean, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}

export function identifier(value: string): void {
  requireInput(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value),
    "INVALID_ID", "Use a nonempty ASCII identifier (letters, digits, dot, underscore or dash).");
}
