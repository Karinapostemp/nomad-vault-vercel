import { useState } from 'react';

export default function CopyButton({ text, label = 'Copy link' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', text);
    }
  }
  return (
    <button type="button" className="btn btn-secondary btn-small" onClick={copy} aria-live="polite">
      {copied ? 'Copied' : label}
    </button>
  );
}
