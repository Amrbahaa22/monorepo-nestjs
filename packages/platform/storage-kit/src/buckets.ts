export const BUCKETS = {
  /** Versioned + object-locked. Retention is a compliance requirement. */
  kycDocuments: "kyc-documents",
  /** Generated artefacts. Regenerable, so no lock and its own lifecycle. */
  statements: "statements",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export interface BucketPolicy {
  readonly name: BucketName;
  readonly versioned: boolean;
  readonly objectLockYears: number | null;
}

export const BUCKET_POLICIES: readonly BucketPolicy[] = [
  { name: BUCKETS.kycDocuments, versioned: true, objectLockYears: 7 },
  { name: BUCKETS.statements, versioned: false, objectLockYears: null },
];
