const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Keys are built, never taken from the client. A caller-supplied key could
 * contain traversal segments and reach another customer's documents.
 */
export function kycObjectKey(customerId: string, filename: string): string {
  assertSafe(customerId, "customerId");
  assertSafe(filename, "filename");
  return `kyc/${customerId}/${filename}`;
}

export function statementObjectKey(accountId: string, period: string): string {
  assertSafe(accountId, "accountId");
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`period must be YYYY-MM, got "${period}"`);
  }
  return `statements/${accountId}/${period}.pdf`;
}

function assertSafe(value: string, label: string): void {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`${label} contains unsupported characters: "${value}"`);
  }
}
