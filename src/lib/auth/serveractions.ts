"use server";
import * as handlers from "./handlers";
export async function auth() {
  return await handlers.auth();
}

export async function signOut() {
  return await handlers.signOut();
}
