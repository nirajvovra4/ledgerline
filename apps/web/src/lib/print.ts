/** Print the current page (wrapped so tests can stub it and pages stay declarative). */
export function printPage(): void {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}
