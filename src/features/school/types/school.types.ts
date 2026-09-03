/** Fields editable from the School Profile page (General Info + Address + Branding + Administration name). */
export interface SchoolProfileUpdateInput {
  name?: string;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  physicalAddress?: string | null;
  postalAddress?: string | null;
  principalName?: string | null;
}

/** Regional/config fields, kept distinct from profile fields since they're rarely edited together. */
export interface SchoolSettingsUpdateInput {
  timezone?: string;
  currency?: string;
  language?: string;
}

/** Billing/invoicing configuration — the Finance domain's per-school settings (spec 4.D / 51). */
export interface SchoolBillingUpdateInput {
  vatRegistered?: boolean;
  vatNumber?: string | null;
  vatRate?: number;
  invoiceNumberPrefix?: string;
  receiptNumberPrefix?: string;
  invoiceDueDays?: number;
  invoiceFooterNote?: string | null;
  bankingDetails?: string | null;
}
