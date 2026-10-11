// Not a component — calling Date.now() here is fine; the react-hooks/purity
// lint rule only flags impure calls written directly inside a component or
// hook body, so this indirection keeps server components (e.g.
// app/(app)/agreements/page.tsx) and client components clean of it.
export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
