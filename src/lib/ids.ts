export function newId(): string {
  return crypto.randomUUID();
}

export function nu(): string {
  return new Date().toISOString();
}
