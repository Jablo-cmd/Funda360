import { useCallback, useEffect, useState } from 'react';
import { paymentGatewayService } from '@/features/fees/services/paymentGatewayService';
import type { PaymentGatewayConfig } from '@/features/fees/types/paymentGateway.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UsePaymentGatewayConfigResult {
  config: PaymentGatewayConfig | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** The school's payment-gateway configuration (finance-tier read). `null` = not configured / online payments unavailable. */
export function usePaymentGatewayConfig(schoolId: string | undefined): UsePaymentGatewayConfigResult {
  const [config, setConfig] = useState<PaymentGatewayConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setConfig(await paymentGatewayService.getConfig(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load payment settings.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { config, isLoading, error, refetch: load };
}
