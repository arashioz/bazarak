export default function BrandLogo({ inverted = false }: { inverted?: boolean }) {
  return <span className={`brand-logo${inverted ? " brand-logo--inverted" : ""}`}>
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="brand-logo-mark">
      <rect width="48" height="48" rx="15" fill="currentColor" />
      <path d="M13 21v14a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V21M18 38V27h12v11" stroke="#fff6ed" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m12 20 4-10h16l4 10c0 4-6 5-8 1-2 4-6 4-8 0-2 4-8 3-8-1Z" fill="#efd5a5" stroke="#fff6ed" strokeWidth="2" strokeLinejoin="round" />
    </svg>
    <span className="brand-logo-name">بازارک</span>
  </span>;
}
