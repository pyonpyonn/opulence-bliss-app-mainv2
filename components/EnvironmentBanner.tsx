export default function EnvironmentBanner() {
  if (process.env.VERCEL_ENV !== "preview") return null;

  return (
    <div className="preproduction-banner" role="status">
      Pre-production testing — actions here are for testing and may be reset.
    </div>
  );
}
