/**
 * Loader.tsx — Bouncing balls loading animation
 * Original CSS by mobinkakei from Uiverse.io
 * Used as the app-wide loading screen while auth is being verified.
 */

export default function Loader({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-background">
      {/* Bouncing balls */}
      <div className="loader-wrapper">
        <div className="loader-circle" />
        <div className="loader-circle" />
        <div className="loader-circle" />
        <div className="loader-shadow" />
        <div className="loader-shadow" />
        <div className="loader-shadow" />
      </div>

      {/* App name + loading text */}
      <div className="text-center space-y-1">
        <div className="font-display text-xl font-bold bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
          Smart Finance
        </div>
        <div className="text-sm text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}
