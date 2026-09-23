// Tiny class-name joiner used by primitive components.
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
