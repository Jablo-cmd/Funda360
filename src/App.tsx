import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { ProfileProvider } from '@/features/profile/context/ProfileProvider';
import { TenantProvider } from '@/features/tenant/context/TenantProvider';
import { AppRoutes } from '@/app/AppRoutes';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <TenantProvider>
            <AppRoutes />
          </TenantProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
