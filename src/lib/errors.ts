import { z } from "zod";

export class ApiError extends Error {
  code: string;
  constructor(options: { code: string; message: string; cause?: unknown }) {
    super(options.message, { cause: options.cause });
    this.name = "ApiError";
    this.code = options.code;
  }

  toJson(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }

  isTagged(tag: string): boolean {
    return this.code === tag;
  }
}

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type Result<S, F> =
  | { type: "success"; value: S }
  | { type: "failure"; error: F };
