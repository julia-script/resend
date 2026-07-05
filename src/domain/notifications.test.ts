import { beforeEach, expect, test, vi } from "vitest";
import type { PartialDomain } from "@/shared/domain";

const { batchSendMock, getUserEmailsMock } = vi.hoisted(() => ({
  batchSendMock: vi.fn(async (_payloads: unknown[]) => ({
    data: [{ id: "email_1" }],
    error: null,
  })),
  getUserEmailsMock: vi.fn(
    async (ids: string[]) =>
      new Map(ids.map((id) => [id, `${id}@example.com`])),
  ),
}));

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSendMock };
  },
}));
vi.mock("@/db/users", () => ({ getUserEmails: getUserEmailsMock }));

import { dispatchNotifications } from "./notifications";

const makeDomain = (overrides: Partial<PartialDomain>) =>
  ({
    id: "d1",
    name: "example.com",
    userId: "u1",
    ...overrides,
  }) as PartialDomain;
const domain = makeDomain({});

beforeEach(() => {
  vi.clearAllMocks();
});

test("sends one batch for multiple notifications across domains", async () => {
  await dispatchNotifications([
    { event: "notifyVerificationSucceeded", domain },
    {
      event: "notifyDomainSuperseded",
      domain: makeDomain({ id: "d2", userId: "u2", name: "other.com" }),
    },
  ]);
  expect(batchSendMock).toHaveBeenCalledTimes(1);
  const payloads = batchSendMock.mock.calls[0][0] as Array<{
    to: string[];
    subject: string;
  }>;
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toMatchObject({
    to: ["u1@example.com"],
    subject: "example.com is verified",
  });
  expect(payloads[1]).toMatchObject({
    to: ["u2@example.com"],
    subject: "other.com was verified by another account",
  });
});

test("grace period start is deliberately silent", async () => {
  await dispatchNotifications([{ event: "notifyGracePeriodStarted", domain }]);
  expect(batchSendMock).not.toHaveBeenCalled();
  // ...and doesn't even look up users.
  expect(getUserEmailsMock).not.toHaveBeenCalled();
});

test("mixed events only send the notifiable ones", async () => {
  await dispatchNotifications([
    { event: "notifyGracePeriodStarted", domain },
    { event: "notifyGracePeriodWarning", domain },
  ]);
  const payloads = batchSendMock.mock.calls[0][0] as Array<{ subject: string }>;
  expect(payloads).toHaveLength(1);
  expect(payloads[0].subject).toBe(
    "Action needed: DKIM record for example.com is failing",
  );
});

test("notifications for users without an email are skipped", async () => {
  getUserEmailsMock.mockResolvedValueOnce(new Map());
  await dispatchNotifications([
    { event: "notifyVerificationSucceeded", domain },
  ]);
  expect(batchSendMock).not.toHaveBeenCalled();
});

test("chunks batches of more than 100 payloads", async () => {
  const notifications = Array.from({ length: 150 }, (_, i) => ({
    event: "notifyVerificationSucceeded" as const,
    domain: makeDomain({ id: `d${i}`, userId: `u${i}` }),
  }));
  await dispatchNotifications(notifications);
  expect(batchSendMock).toHaveBeenCalledTimes(2);
  expect(batchSendMock.mock.calls[0][0]).toHaveLength(100);
  expect(batchSendMock.mock.calls[1][0]).toHaveLength(50);
});

test("send errors are swallowed, not thrown", async () => {
  batchSendMock.mockResolvedValueOnce({
    data: null,
    error: { message: "rate limited" },
  } as never);
  await expect(
    dispatchNotifications([{ event: "notifyVerificationSucceeded", domain }]),
  ).resolves.toBeUndefined();
});
