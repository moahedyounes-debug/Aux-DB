import logoAsset from "@/assets/aux-logo.png.asset.json";

interface AuxLogoProps {
  className?: string;
  variant?: "light" | "dark";
  showWordmark?: boolean;
}

/**
 * Official AUX brand logo (image), with optional "ASC Intelligence" wordmark.
 */
export function AuxLogo({ className, variant = "dark", showWordmark = true }: AuxLogoProps) {
  const isLight = variant === "light";
  const subFill = isLight ? "text-white/70" : "text-muted-foreground";
  const wordFill = isLight ? "text-white" : "text-foreground";

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <div className={isLight ? "flex h-full items-center rounded-md bg-white px-2 py-1 shadow-sm" : "flex h-full items-center"}>
        <img
          src={logoAsset.url}
          alt="AUX"
          className="h-full w-auto object-contain"
          draggable={false}
        />
      </div>
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className={`text-[10px] font-semibold tracking-[0.24em] ${subFill}`}>
            ASC INTELLIGENCE
          </span>
          <span className={`text-[10px] font-medium tracking-[0.18em] ${wordFill} opacity-70`}>
            DASHBOARD
          </span>
        </div>
      )}
    </div>
  );
}