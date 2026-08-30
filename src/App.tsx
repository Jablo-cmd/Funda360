import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { ProfileProvider } from '@/features/profile/context/ProfileProvider';
import { TenantProvider } from '@/features/tenant/context/TenantProvider';
import { SchoolProvider } from '@/features/school/context/SchoolProvider';
import { AcademicProvider } from '@/features/academic/context/AcademicProvider';
import { AppRoutes } from '@/app/AppRoutes';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ProfileProvider>
            <TenantProvider>
              <SchoolProvider>
                <AcademicProvider>
                  <AppRoutes />
                </AcademicProvider>
              </SchoolProvider>
            </TenantProvider>
          </ProfileProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
