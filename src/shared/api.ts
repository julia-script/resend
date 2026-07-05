import { z } from "zod";
import { PartialDomainSchema } from "./domain";

// The wire contract, shared verbatim by the OpenAPI route definitions and
// the client's response validation — the two sides cannot drift.

export const CreateDomainInputSchema = z.object({
  name: z.string().min(1),
  enforce: z.boolean().optional(),
});
export type CreateDomainInput = z.infer<typeof CreateDomainInputSchema>;

export const DomainResponseSchema = z.object({ data: PartialDomainSchema });
export const DomainListResponseSchema = z.object({
  data: z.array(PartialDomainSchema),
});
export const DeleteDomainResponseSchema = z.object({
  data: z.object({ id: z.string() }),
});
export const CronSweepResponseSchema = z.object({
  ok: z.boolean(),
  checked: z.number(),
  failed: z.number(),
});
