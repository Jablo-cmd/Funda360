import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePaymentGatewayConfig } from '@/features/fees/hooks/usePaymentGatewayConfig';
import { paymentGatewayService } from '@/features/fees/services/paymentGatewayService';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PROVIDER_PUBLIC_FIELDS,
} from '@/features/fees/types/paymentGateway.types';
import type { PaymentProvider, PaymentMode } from '@/features/fees/types/paymentGateway.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

function Feedback({ ok, msg }: { ok: boolean; msg: string | null }) {
  if (!msg) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border px-3.5 py-2.5 text-sm font-medium ${
        ok
          ? 'border-success-500/30 bg-success-500/10 text-success-600'
          : 'border-danger-500/30 bg-danger-50 text-danger-600'
      }`}
    >
      {msg}
    </p>
  );
}

/** Finance-manager configuration for the Finance domain: invoice/receipt numbering, VAT, banking details, and the online payment provider. */
export function PaymentSettingsPage() {
  const { school, updateSchoolBilling } = useSchool();
  const { config, isLoading, error, refetch } = usePaymentGatewayConfig(school?.id);

  // Billing form state.
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [vatRate, setVatRate] = useState('0');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [receiptPrefix, setReceiptPrefix] = useState('RCT');
  const [dueDays, setDueDays] = useState('30');
  const [footerNote, setFooterNote] = useState('');
  const [banking, setBanking] = useState('');
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // Gateway form state.
  const [provider, setProvider] = useState<PaymentProvider>('payfast');
  const [mode, setMode] = useState<PaymentMode>('test');
  const [enabled, setEnabled] = useState(false);
  const [merchantConfig, setMerchantConfig] = useState<Record<string, string>>({});
  const [gatewayBusy, setGatewayBusy] = useState(false);
  const [gatewayMsg, setGatewayMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!school) return;
    setVatRegistered(school.vatRegistered);
    setVatNumber(school.vatNumber ?? '');
    setVatRate(String(school.vatRate));
    setInvoicePrefix(school.invoiceNumberPrefix);
    setReceiptPrefix(school.receiptNumberPrefix);
    setDueDays(String(school.invoiceDueDays));
    setFooterNote(school.invoiceFooterNote ?? '');
    setBanking(school.bankingDetails ?? '');
  }, [school]);

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider);
    setMode(config.mode);
    setEnabled(config.enabled);
    setMerchantConfig(config.merchantConfig);
  }, [config]);

  const saveBilling = async () => {
    setBillingBusy(true);
    setBillingMsg(null);
    try {
      await updateSchoolBilling({
        vatRegistered,
        vatNumber: vatNumber.trim() || null,
        vatRate: Number(vatRate) || 0,
        invoiceNumberPrefix: invoicePrefix.trim() || 'INV',
        receiptNumberPrefix: receiptPrefix.trim() || 'RCT',
        invoiceDueDays: Number(dueDays) || 30,
        invoiceFooterNote: footerNote.trim() || null,
        bankingDetails: banking.trim() || null,
      });
      setBillingMsg({ ok: true, msg: 'Billing settings saved.' });
    } catch (err) {
      setBillingMsg({ ok: false, msg: getDbErrorMessage(err, 'Failed to save billing settings.') });
    } finally {
      setBillingBusy(false);
    }
  };

  const saveGateway = async () => {
    if (!school) return;
    setGatewayBusy(true);
    setGatewayMsg(null);
    try {
      await paymentGatewayService.upsertConfig(school.id, { provider, mode, enabled, merchantConfig });
      await refetch();
      setGatewayMsg({ ok: true, msg: 'Payment provider settings saved.' });
    } catch (err) {
      setGatewayMsg({ ok: false, msg: getDbErrorMessage(err, 'Failed to save payment provider settings.') });
    } finally {
      setGatewayBusy(false);
    }
  };

  if (!school) return <NoActiveSchoolNotice resource="payment settings" />;

  return (
    <PageContainer>
      <PageHeader title="Payment Settings" description="Invoice and receipt numbering, VAT, and the online payment provider." />

      {isLoading ? (
        <LoadingBlock label="Loading payment settings…" />
      ) : (
        <div className="flex flex-col gap-8">
          <ErrorAlert message={error} />

          <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
            <h2 className="mb-4 text-base font-semibold text-content-primary">Billing &amp; invoicing</h2>
            <div className="flex flex-col gap-4">
              <Feedback ok={billingMsg?.ok ?? false} msg={billingMsg?.msg ?? null} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="Invoice number prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
                <TextField label="Receipt number prefix" value={receiptPrefix} onChange={(e) => setReceiptPrefix(e.target.value)} />
                <TextField
                  label="Payment terms (days)"
                  type="number"
                  min={0}
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                />
                <TextField
                  label="VAT rate (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-content-primary">
                <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)} />
                School is VAT-registered
              </label>
              {vatRegistered && (
                <TextField label="VAT number" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
              )}
              <TextField label="Banking details (printed on invoices)" value={banking} onChange={(e) => setBanking(e.target.value)} />
              <TextField label="Invoice footer note" value={footerNote} onChange={(e) => setFooterNote(e.target.value)} />
              <div className="w-full sm:w-48">
                <Button type="button" onClick={() => void saveBilling()} isLoading={billingBusy}>
                  Save billing settings
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
            <h2 className="mb-1 text-base font-semibold text-content-primary">Online payment provider</h2>
            <p className="mb-4 text-sm text-content-secondary">
              Enter the provider&apos;s public identifiers here. Secret keys / passphrases are configured separately as
              Edge Function secrets and never stored in the application — see the deployment documentation.
            </p>
            <div className="flex flex-col gap-4">
              <Feedback ok={gatewayMsg?.ok ?? false} msg={gatewayMsg?.msg ?? null} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="gw-provider" className="mb-1.5 block text-sm font-medium text-content-primary">
                    Provider
                  </label>
                  <select
                    id="gw-provider"
                    className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
                    value={provider}
                    onChange={(e) => {
                      setProvider(e.target.value as PaymentProvider);
                      setMerchantConfig({});
                    }}
                  >
                    {PAYMENT_PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {PAYMENT_PROVIDER_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="gw-mode" className="mb-1.5 block text-sm font-medium text-content-primary">
                    Mode
                  </label>
                  <select
                    id="gw-mode"
                    className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as PaymentMode)}
                  >
                    <option value="test">Test / sandbox</option>
                    <option value="live">Live</option>
                  </select>
                </div>
              </div>

              {PROVIDER_PUBLIC_FIELDS[provider].map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={merchantConfig[field.key] ?? ''}
                  onChange={(e) => setMerchantConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              ))}

              <label className="flex items-center gap-2 text-sm text-content-primary">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Enable online payments for guardians
              </label>
              {config?.secretLastSetAt && (
                <p className="text-xs text-content-tertiary">
                  Provider secrets last confirmed: {new Date(config.secretLastSetAt).toLocaleDateString('en-ZA')}
                </p>
              )}
              <div className="w-full sm:w-56">
                <Button type="button" onClick={() => void saveGateway()} isLoading={gatewayBusy}>
                  Save provider settings
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
