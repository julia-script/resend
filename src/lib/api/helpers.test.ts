import { expect, test } from "vitest";
import { ApiError } from "./helpers";

const map = () => ({ code: "test/failed", message: "failed" });

test("mapToValue wraps async success", async () => {
  const result = await ApiError.mapToValue({ fn: async () => [1, 2], map });
  expect(result).toEqual({ type: "success", value: [1, 2] });
});

test("mapToValue passes through async ApiError", async () => {
  const err = new ApiError({ code: "db/boom", message: "boom" });
  const result = await ApiError.mapToValue({
    fn: async () => {
      throw err;
    },
    map,
  });
  expect(result).toEqual({ type: "failure", error: err });
});

test("mapToValue maps unknown async errors", async () => {
  const result = await ApiError.mapToValue({
    fn: async () => {
      throw new Error("raw");
    },
    map,
  });
  expect(result.type).toBe("failure");
  if (result.type === "failure") expect(result.error.code).toBe("test/failed");
});
