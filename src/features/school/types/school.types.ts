/** Fields editable from the School Profile page (General Info + Address + Branding + Administration name). */
export interface SchoolProfileUpdateInput {
  name?: string;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
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
