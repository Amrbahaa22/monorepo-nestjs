import { describe, expect, it } from "@jest/globals";
import {
  buildRetryHeaders,
  HEADER_ATTEMPT,
  HEADER_ORIGINAL_TOPIC,
  readRetryContext,
} from "./retry-headers";

describe("retry headers", () => {
  it("round-trips a retry context", () => {
    const headers = buildRetryHeaders({
      originalTopic: "ledger.commands.v1",
      attempt: 2,
    });
    expect(readRetryContext(headers, "ignored")).toEqual({
      originalTopic: "ledger.commands.v1",
      attempt: 2,
    });
  });

  it("treats a message with no headers as first delivery on its own topic", () => {
    expect(readRetryContext(undefined, "ledger.commands.v1")).toEqual({
      originalTopic: "ledger.commands.v1",
      attempt: 0,
    });
  });

  it("decodes Buffer header values as a broker delivers them", () => {
    const headers = {
      [HEADER_ORIGINAL_TOPIC]: Buffer.from("ledger.commands.v1"),
      [HEADER_ATTEMPT]: Buffer.from("1"),
    };
    expect(readRetryContext(headers, "ignored")).toEqual({
      originalTopic: "ledger.commands.v1",
      attempt: 1,
    });
  });

  it("rejects a non-numeric attempt header instead of resetting the count", () => {
    const headers = { [HEADER_ATTEMPT]: "banana" };
    expect(() => readRetryContext(headers, "ledger.commands.v1")).toThrow();
  });
});
