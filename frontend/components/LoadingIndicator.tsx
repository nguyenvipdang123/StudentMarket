export default function LoadingIndicator({ label = "Đang tải…" }: { label?: string }) {
  return <span className="wait-indicator" role="status" aria-live="polite">
    <span className="wait-spinner" aria-hidden="true" />
    <span>{label}</span>
  </span>;
}
