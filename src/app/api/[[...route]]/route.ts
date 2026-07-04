import { handle } from "hono/vercel";
import { app } from "@/lib/api/setup";

// DNS checks can chain several queries; give cron ticks headroom.
export const maxDuration = 60;

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
