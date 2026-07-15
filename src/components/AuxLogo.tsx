interface AuxLogoProps {
  className?: string;
  variant?: "light" | "dark";
}

export function AuxLogo({ className, variant = "dark" }: AuxLogoProps) {
  const fill = variant === "light" ? "var(--color-sidebar-accent-foreground)" : "var(--color-primary)";
  return (
    <svg
      viewBox="0 0 120 32"
      className={className}
      role="img"
      aria-label="AUX"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="4" width="34" height="24" rx="6" fill={fill} />
      <text
        x="17"
        y="22"
        textAnchor="middle"
        fontFamily="DM Sans, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill="var(--color-primary-foreground)"
      >
        AUX
      </text>
      <text
        x="42"
        y="22"
        fontFamily="DM Sans, sans-serif"
        fontWeight="600"
        fontSize="13"
        letterSpacing="0.5"
        fill={fill}
      >
        ASC Dashboard
      </text>
    </svg>
  );
}