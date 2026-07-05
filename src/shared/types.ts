/** Make the given keys required while leaving the rest of T untouched. */
export type RequiredBy<T, K extends keyof T> = Required<Pick<T, K>> &
  Omit<T, K>;
