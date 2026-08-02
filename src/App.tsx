import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { ProfileProvider } from '@/features/profile/context/ProfileProvider';
import { TenantProvider } from '@/features/tenant/context/TenantProvider';
import { SchoolProvider } from '@/features/school/context/SchoolProvider';
import { AppRoutes } from '@/app/AppRoutes';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <TenantProvider>
            <SchoolProvider>
              <AppRoutes />
            </SchoolProvider>
          </TenantProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
