import { describe, expect, it } from "@jest/globals";
import type { EventPublisher } from "@monorepo/domain";
import type { Database } from "../db/client";
import { SagaService } from "./saga.service";

const sagaRow = {
  paymentId: "3f1a9c2e-9b3d-4a1e-8c5b-7d2f4e6a1b90",
  state: "RESERVING",
  sourceAccountId: "acct_source",
  destinationAccountId: "acct_dest",
  amountMinorUnits: 5000n,
  currency: "USD",
};

function fakeDb(state: string, calls: string[]) {
  return {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: async () => {
          calls.push("insert");
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ ...sagaRow, state }] }),
      }),
    }),
    update: () => ({
      set: (values: { state: string }) => ({
        where: async () => {
          calls.push(`state:${values.state}`);
        },
      }),
    }),
  } as unknown as Database;
}

function fakePublisher(calls: string[]): EventPublisher {
  return {
    publish: async (topic, envelope) => {
      const payload = envelope.payload as { type: string };
      calls.push(`publish:${topic}:${payload.type}`);
    },
  };
}

const postingCompleted = (phase: "reserve" | "capture" | "release") => ({
  version: 1 as const,
  type: "PostingCompleted" as const,
  paymentId: sagaRow.paymentId,
  occurredAt: "2026-08-09T10:00:00.000Z",
  payload: { phase, batchId: "3f1a9c2e-9b3d-4a1e-8c5b-7d2f4e6a1b90" },
});

describe("SagaService", () => {
  it("requests screening once the reserve posting completes", async () => {
    const calls: string[] = [];
    const service = new SagaService(
      fakeDb("RESERVING", calls),
      fakePublisher(calls),
    );

    await service.handlePostingCompleted(postingCompleted("reserve"));

    expect(calls).toEqual([
      "publish:risk.commands.v1:ScreenPayment",
      "state:SCREENING",
    ]);
  });

  it("publishes before persisting the new state, so a crash replays rather than loses", async () => {
    const calls: string[] = [];
    const service = new SagaService(
      fakeDb("CAPTURING", calls),
      fakePublisher(calls),
    );

    await service.handlePostingCompleted(postingCompleted("capture"));

    expect(calls).toEqual([
      "publish:payout.commands.v1:SubmitPayout",
      "state:PAYING_OUT",
    ]);
  });

  it("posts a capture batch when risk approves", async () => {
    const calls: string[] = [];
    const service = new SagaService(
      fakeDb("SCREENING", calls),
      fakePublisher(calls),
    );

    await service.handleRiskDecided({
      version: 1,
      type: "RiskDecided",
      paymentId: sagaRow.paymentId,
      occurredAt: "2026-08-09T10:00:00.000Z",
      payload: { decision: "approved", rulesetVersion: "2026.08.1" },
    });

    expect(calls).toEqual([
      "publish:ledger.commands.v1:PostBatch",
      "state:CAPTURING",
    ]);
  });

  it("compensates instead of failing when risk declines", async () => {
    const calls: string[] = [];
    const service = new SagaService(
      fakeDb("SCREENING", calls),
      fakePublisher(calls),
    );

    await service.handleRiskDecided({
      version: 1,
      type: "RiskDecided",
      paymentId: sagaRow.paymentId,
      occurredAt: "2026-08-09T10:00:00.000Z",
      payload: {
        decision: "declined",
        rulesetVersion: "2026.08.1",
        reason: "source_account_sanctioned",
      },
    });

    expect(calls).toEqual([
      "publish:ledger.commands.v1:PostBatch",
      "state:COMPENSATING",
    ]);
  });

  it("completes the saga on a settled payout without publishing anything further", async () => {
    const calls: string[] = [];
    const service = new SagaService(
      fakeDb("PAYING_OUT", calls),
      fakePublisher(calls),
    );

    await service.handlePayoutCompleted({
      version: 1,
      type: "PayoutCompleted",
      paymentId: sagaRow.paymentId,
      occurredAt: "2026-08-09T10:00:00.000Z",
      payload: { outcome: "settled", partnerReference: "pmt-1" },
    });

    expect(calls).toEqual(["state:COMPLETED"]);
  });

  it("does nothing when an event arrives for a state it does not apply to", async () => {
    const calls: string[] = [];
    const service = new SagaService(
      fakeDb("COMPLETED", calls),
      fakePublisher(calls),
    );

    await service.handlePostingCompleted(postingCompleted("reserve"));

    expect(calls).toEqual([]);
  });
});
