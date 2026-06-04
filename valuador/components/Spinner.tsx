export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`spinner inline-block rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
