import { describe, expect, it } from "@jest/globals";
import { kycObjectKey, statementObjectKey } from "./object-keys";

describe("kycObjectKey", () => {
  it("namespaces documents by customer", () => {
    expect(kycObjectKey("cust_1", "passport.pdf")).toBe(
      "kyc/cust_1/passport.pdf",
    );
  });

  it("rejects a path traversal attempt in the customer id", () => {
    expect(() => kycObjectKey("../other", "passport.pdf")).toThrow();
  });

  it("rejects a path traversal attempt in the filename", () => {
    expect(() => kycObjectKey("cust_1", "../../etc/passwd")).toThrow();
  });

  it("rejects a slash smuggled into a segment", () => {
    expect(() => kycObjectKey("cust_1/cust_2", "a.pdf")).toThrow();
  });
});

describe("statementObjectKey", () => {
  it("builds a period-scoped pdf key", () => {
    expect(statementObjectKey("acct_1", "2026-08")).toBe(
      "statements/acct_1/2026-08.pdf",
    );
  });

  it("rejects a malformed period", () => {
    expect(() => statementObjectKey("acct_1", "August")).toThrow();
  });
});
