interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  // Extract a user-friendly message from technical error details
  const getDisplayMessage = (msg: string): string => {
    // If it's an API endpoint error, show a simplified message
    if (msg.includes('API endpoint not found')) {
      return 'Unable to connect to the API. Please check that the backend service is running.';
    }
    if (msg.includes('Failed to parse JSON')) {
      return 'Received an unexpected response from the server. The API may not be available.';
    }
    // For other errors, show the full message but format it nicely
    return msg;
  };

  const displayMessage = getDisplayMessage(message);

  return (
    <div className="error-state">
      <div className="error-icon">⚠️</div>
      <p className="error-message">{displayMessage}</p>
      {message.includes('http://') || message.includes('https://') ? (
        <details className="error-details">
          <summary>Technical details</summary>
          <pre>{message}</pre>
        </details>
      ) : null}
      {onRetry && (
        <button type="button" onClick={onRetry} className="error-retry">
          Retry
        </button>
      )}
    </div>
  );
}

