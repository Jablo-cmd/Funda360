import { SchoolProfileForm } from '@/features/school/components/SchoolProfileForm';
import { SchoolSettingsForm } from '@/features/school/components/SchoolSettingsForm';

export function SchoolProfilePage() {
  return (
    <>
      <SchoolProfileForm />
      <SchoolSettingsForm />
    </>
  );
}
