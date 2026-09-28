/**
 * Logo do Dueto: dois círculos que se sobrepõem, a pessoa física e a pessoa jurídica
 * tocando juntas. O preenchido é a PF; o contornado é a PJ.
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Dueto">
      <rect x="0" y="0" width="32" height="32" rx="8" fill="var(--accent)" />
      <circle cx="12.5" cy="16" r="6.5" fill="var(--on-accent)" />
      <circle cx="19.5" cy="16" r="6.5" fill="none" stroke="var(--on-accent)" strokeWidth="2.2" />
    </svg>
  );
}
