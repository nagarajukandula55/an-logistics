// Generates a human-readable, sortable tracking code like AN-LX7K9P2Q.
// Timestamp (base36) keeps codes roughly chronological; a short random
// suffix avoids collisions for orders created within the same millisecond.
export function generateTrackingCode(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AN-${time}${random}`;
}
