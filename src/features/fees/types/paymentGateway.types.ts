import type { PaymentProvider, PaymentMode, PaymentIntentStatus } from '@/lib/database.types';

export type { PaymentProvider, PaymentMode, PaymentIntentStatus };

export const PAYMENT_PROVIDERS: PaymentProvider[] = ['payfast', 'ozow', 'peach', 'yoco', 'netcash'];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  payfast: 'PayFast',
  ozow: 'Ozow',
  peach: 'Peach Payments',
  yoco: 'Yoco',
  netcash: 'Netcash',
};

/**
 * The non-secret identifiers each provider needs, entered in the school's
 * Payment Settings. Secrets (passphrases, private keys, API secrets) are
 * NEVER entered here — they are set as Edge Function environment variables
 * (see docs/PAYMENT_GATEWAY.md).
 */
export const PROVIDER_PUBLIC_FIELDS: Record<PaymentProvider, { key: string; label: string; hint?: string }[]> = {
  payfast: [
    { key: 'merchant_id', label: 'Merchant ID' },
    { key: 'merchant_key', label: 'Merchant Key' },
  ],
  ozow: [
    { key: 'site_code', label: 'Site Code' },
    { key: 'country_code', label: 'Country Code', hint: 'e.g. ZA' },
  ],
  peach: [
    { key: 'entity_id', label: 'Entity ID' },
  ],
  yoco: [
    { key: 'public_key', label: 'Public Key' },
  ],
  netcash: [
    { key: 'service_key', label: 'Pay Now Service Key' },
    { key: 'account_number', label: 'Account Number' },
  ],
};

export interface PaymentGatewayConfig {
  id: string;
  schoolId: string;
  provider: PaymentProvider;
  mode: PaymentMode;
  enabled: boolean;
  merchantConfig: Record<string, string>;
  secretLastSetAt: string | null;
  updatedAt: string;
}

export interface CreatePaymentGatewayConfigInput {
  provider: PaymentProvider;
  mode: PaymentMode;
  enabled: boolean;
  merchantConfig: Record<string, string>;
}

export interface PaymentIntent {
  id: string;
  schoolId: string;
  learnerId: string;
  invoiceId: string | null;
  provider: PaymentProvider;
  mode: PaymentMode;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  reference: string;
  providerReference: string | null;
  returnUrl: string | null;
  cancelUrl: string | null;
  paymentId: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** The redirect instruction the initiate Edge Function returns. */
export interface PaymentRedirect {
  method: 'GET' | 'POST';
  url: string;
  fields: Record<string, string>;
}
