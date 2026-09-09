import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInvoice } from '../../api/invoices';
import { useTaxRates } from '../../api/taxRates';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { IconPrint } from '../../components/Icons';
import { SkeletonRows } from '../../components/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useWorkspace } from '../../hooks/useWorkspace';
import { printPage } from '../../lib/print';
import { modelFromInvoice } from './documentModel';
import { InvoiceDocument } from './InvoiceDocument';

/** Standalone printable document (no shell). `?auto=1` opens the print dialog on load. */
export function InvoicePrintPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { base } = useWorkspace();
  const query = useInvoice(id);
  const taxRates = useTaxRates();
  useDocumentTitle(query.data ? `${query.data.number} · print` : 'Print invoice');

  useEffect(() => {
    if (query.data && params.get('auto') === '1') {
      const t = setTimeout(printPage, 300);
      return () => clearTimeout(t);
    }
  }, [query.data, params]);

  if (query.isLoading) return <SkeletonRows rows={8} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;
  return (
    <div className="print-page">
      <div className="print-page__bar no-print">
        <Link to={`${base}/invoices/${id}`}>← Back to invoice</Link>
        <Button variant="primary" icon={<IconPrint />} onClick={printPage}>
          Print
        </Button>
      </div>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <InvoiceDocument model={modelFromInvoice(query.data, taxRates.data ?? [])} />
      </div>
    </div>
  );
}
