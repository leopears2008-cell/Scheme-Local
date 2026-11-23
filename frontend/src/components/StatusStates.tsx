/** Reusable loading skeleton — shows 3 card-shaped shimmer blocks. */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading…" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text-sm" />
        </div>
      ))}
    </div>
  );
}

/** Reusable empty state with optional call-to-action. */
export function EmptyState({
  icon = "📋",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {body && <p className="small">{body}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

/** Reusable error display with an optional retry button. */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <div className="error-icon">⚠️</div>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="link">
          Try again
        </button>
      )}
    </div>
  );
}
