/** Returns a function that logs elapsed ms when called. */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
