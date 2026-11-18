export function Art({ name }: { name: string }) {
  const common = { width: 180, height: 140, viewBox: "0 0 180 140" };
  if (name === "soil") {
    return (
      <svg {...common} aria-hidden>
        <rect width="180" height="140" rx="18" fill="#efe2cf" />
        <path d="M10 90h160v30H10z" fill="#6b3f2a" />
        <path d="M20 90c20-24 40-10 60-28 18 16 34 8 70 20v8H20z" fill="#2c6b45" />
      </svg>
    );
  }
  if (name === "nursery") {
    return (
      <svg {...common} aria-hidden>
        <rect width="180" height="140" rx="18" fill="#f3ead8" />
        <rect x="30" y="70" width="120" height="36" rx="8" fill="#8a5a3b" />
        <path d="M55 70c0-24 12-36 12-36s12 12 12 36" fill="#2c6b45" />
        <path d="M100 70c0-28 14-42 14-42s14 14 14 42" fill="#1e4630" />
      </svg>
    );
  }
  if (name === "market") {
    return (
      <svg {...common} aria-hidden>
        <rect width="180" height="140" rx="18" fill="#f8efe2" />
        <path d="M30 78h120l-14-28H44z" fill="#c24b32" />
        <rect x="48" y="78" width="84" height="28" fill="#6b3f2a" />
        <circle cx="70" cy="64" r="8" fill="#de6a45" />
        <circle cx="108" cy="60" r="10" fill="#c24b32" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <rect width="180" height="140" rx="18" fill="#f4efe4" />
      <path d="M88 118V62" stroke="#2c6b45" strokeWidth="6" />
      <path d="M88 78c18-4 28-20 24-34-16 2-30 16-24 34z" fill="#2c6b45" />
      <path d="M88 90c-20-2-30-20-22-32 16 0 28 14 22 32z" fill="#1e4630" />
      <circle cx="112" cy="48" r="16" fill="#c24b32" />
    </svg>
  );
}
