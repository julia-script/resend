import { z } from "@hono/zod-openapi";

export class ApiError extends Error {
  code: string;
  constructor(options: {
    code: string;
    message: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "ApiError";
    this.code = options.code;
    this.message = options.message;
  }
  static schema = z.object({
    code: z.string(),
    message: z.string(),
  });

  static mapError<T>(config: {
    fn: () => T;
    map: (error: unknown) => {
      code: string;
      message: string;
    };
  }): T {
    try {
      const result = config.fn();
      if (result instanceof Promise) {
        return result.catch((error) => {
          if (error instanceof ApiError) {
            throw error;
          }
          throw new ApiError(config.map(error));
        }) as T;
      }
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(config.map(error));
    }
  }
  

  

  static mapToValue<T>(config: {
    fn: () => T;
    map: (error: unknown) => { code: string; message: string };
  }): MaybeResultPromise<T, ApiError> {
    try {
      const result = config.fn();
      if (result instanceof Promise) {
        return result.then(
          (value) => ({ type: "success", value }),
          (error) => ({
            type: "failure",
            error:
              error instanceof ApiError ? error : new ApiError(config.map(error)),
          }),
        ) as MaybeResultPromise<T, ApiError>;
      }
      return { type: "success", value: result } as MaybeResultPromise<T, ApiError>;
    } catch (error) {
      if (error instanceof ApiError) {
        return { type: "failure", error } as MaybeResultPromise<T, ApiError>;
      }
      return { type: "failure", error: new ApiError(config.map(error)) } as MaybeResultPromise<T, ApiError>;
    }
  }

  toJson(): { code: string; message: string } {
    return {
      code: this.code,
      message: this.message,
    };
  }
  isTagged(tag: string): boolean {
    return this.code === tag;
  }
}

type Result<S, F> = { type: "success", value: S } | { type: "failure", error: F };
type MaybeResultPromise<T, F> = T extends Promise<infer U> ? Promise<Result<U, F>> : Result<T, F>;
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const _mapError = <T>(config: {
  fn: () => T;
  map: (error: unknown) => unknown;
}): T => {
  try {
    const result = config.fn();
    if (result instanceof Promise) {
      return result.catch((error) => {
        if (error instanceof ApiError) {
          throw error;
        }
        throw config.map(error);
      }) as T;
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw config.map(error);
  }
};
