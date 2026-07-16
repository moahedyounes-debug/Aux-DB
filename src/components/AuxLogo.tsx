interface AuxLogoProps {
  className?: string;
  variant?: "light" | "dark";
  showWordmark?: boolean;
}

/**
 * AUX brand mark — an original geometric monogram.
 * The "A" is formed by two angled bars joined by a bridge; a spark accent
 * hints at signal/insight (fits the ASC operations dashboard context).
 */
export function AuxLogo({ className, variant = "dark", showWordmark = true }: AuxLogoProps) {
  const isLight = variant === "light";
  const gradId = `aux-grad-${variant}`;
  const markStart = isLight ? "#7FB3FF" : "var(--color-primary)";
  const markEnd = isLight ? "#3E7BD6" : "#1E4FA8";
  const wordFill = isLight
    ? "var(--color-sidebar-accent-foreground)"
    : "var(--color-foreground)";
  const subFill = isLight
    ? "color-mix(in oklab, var(--color-sidebar-accent-foreground) 65%, transparent)"
    : "var(--color-muted-foreground)";
  const spark = isLight ? "#FFD166" : "#F59E0B";

  return (
    <svg
      viewBox="0 0 168 40"
      className={className}
      role="img"
      aria-label="AUX ASC Dashboard"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={markStart} />
          <stop offset="100%" stopColor={markEnd} />
        </linearGradient>
      </defs>
      {/* Rounded mark background */}
      <rect x="1" y="2" width="36" height="36" rx="10" fill={`url(#${gradId})`} />
      {/* Monogram "A" — two angled bars + bridge */}
      <path
        d="M11 30 L18 10 L21 10 L28 30 L24.5 30 L23 25.5 L16 25.5 L14.5 30 Z M17 22.5 L22 22.5 L19.5 15 Z"
        fill="#FFFFFF"
      />
      {/* Spark accent (top-right) */}
      <circle cx="31" cy="9" r="2.4" fill={spark} />
      {/* Wordmark */}
      {showWordmark && (
        <>
          <text
            x="46"
            y="22"
            fontFamily="DM Sans, sans-serif"
            fontWeight="800"
            fontSize="18"
            letterSpacing="1.5"
            fill={wordFill}
          >
            AUX
          </text>
          <text
            x="46"
            y="33"
            fontFamily="DM Sans, sans-serif"
            fontWeight="600"
            fontSize="9"
            letterSpacing="2.4"
            fill={subFill}
          >
            ASC INTELLIGENCE
          </text>
        </>
      )}
    </svg>
  );
}