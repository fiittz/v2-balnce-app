const euroFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function fmtEuro(n: number): string {
  return euroFormatter.format(n);
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function fmtTaxYear(y: string | number): string {
  const year = typeof y === "string" ? parseInt(y, 10) : y;
  return `Year ended 31 December ${year}`;
}
