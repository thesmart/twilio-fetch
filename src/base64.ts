export function toBase64(str: string): string {
  return Buffer.from(str).toString('base64');
}

export function fromBase64(base64: string, encoding: BufferEncoding = 'utf-8'): string {
  return Buffer.from(base64, 'base64').toString(encoding);
}
