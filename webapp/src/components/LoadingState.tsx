export function LoadingState({ message = 'Loading library…' }: { message?: string }) {
  return <div className="loading-state">{message}</div>;
}

