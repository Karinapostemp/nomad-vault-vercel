// External link to the public Stellar testnet explorer.
export default function TxLink({ href, children = 'View on Stellar' }) {
  if (!href) return null;
  return (
    <a className="tx-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
