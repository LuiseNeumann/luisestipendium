export function formatEuro(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value.replace(' ', 'T'))
  );
}

export function formatMonth(value: string) {
  return new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' }).format(new Date(`${value}-01T12:00:00`));
}
