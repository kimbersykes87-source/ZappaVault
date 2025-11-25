export function LoadingState({ message = 'Loading library…' }: { message?: string }) {
  return (
    <div className="loading-state">
      <img 
        src="/Zappa-Loading.svg" 
        alt="Loading" 
        className="loading-spinner"
        aria-hidden="true"
      />
      <p>{message}</p>
    </div>
  );
}

