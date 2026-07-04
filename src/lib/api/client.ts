import { up } from "up-fetch";

export const api = up(fetch, () => ({
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
}));
