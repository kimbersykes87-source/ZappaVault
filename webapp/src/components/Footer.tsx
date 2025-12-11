import './Footer.css';

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-links">
        <a href="/privacy-policy.html">Privacy Policy</a>
        <span className="app-footer-separator">•</span>
        <a href="/terms-of-service.html">Terms of Service</a>
        <span className="app-footer-separator">•</span>
        <a href="/dmca-policy.html">DMCA Policy</a>
      </div>
    </footer>
  );
}

