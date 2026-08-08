import { describe, expect, it } from "@jest/globals";
import { BUCKET_POLICIES, BUCKETS } from "./buckets";

describe("bucket policies", () => {
  it("locks and versions the KYC bucket, because retention is a compliance requirement", () => {
    const kyc = BUCKET_POLICIES.find((p) => p.name === BUCKETS.kycDocuments);
    expect(kyc).toMatchObject({ versioned: true, objectLockYears: 7 });
  });

  it("keeps statements in a separate, unlocked bucket", () => {
    const statements = BUCKET_POLICIES.find(
      (p) => p.name === BUCKETS.statements,
    );
    expect(statements).toMatchObject({
      versioned: false,
      objectLockYears: null,
    });
    expect(BUCKETS.statements).not.toBe(BUCKETS.kycDocuments);
  });

  it("declares a policy for every bucket", () => {
    expect(BUCKET_POLICIES).toHaveLength(Object.keys(BUCKETS).length);
  });
});
