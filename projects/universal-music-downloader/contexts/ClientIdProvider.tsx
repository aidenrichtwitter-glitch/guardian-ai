'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffectEvent } from 'react';
import { getClientIdApiPath } from '@/lib/get-api-endpoint';

interface ClientIdContextType {
  clientId: string | null;
  isLoading: boolean;
  error: string | null;
}

const ClientIdContext = createContext<ClientIdContextType | undefined>(undefined);

export const ClientIdProvider = ({ children, initialClientId }: { children: ReactNode; initialClientId?: string | null }) => {
  const [clientId, setClientId] = useState<string | null>(initialClientId || null);
  const [isLoading, setIsLoading] = useState(!initialClientId);
  const [error, setError] = useState<string | null>(null);

  const handleFetchClientId = useCallback(async () => {

    if (initialClientId) return;
    try {
      const res = await fetch(getClientIdApiPath());
      const { clientId, error } = await res.json();
      if (error) {
        throw new Error(error);
      }
      setClientId(clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [initialClientId])


  useEffectEvent(() => {
    handleFetchClientId();
  });

  return (
    <ClientIdContext.Provider value={{ clientId, isLoading, error }}>
      {children}
    </ClientIdContext.Provider>
  );
};

export const useClientId = () => {
  const context = useContext(ClientIdContext);
  if (context === undefined) {
    throw new Error('useClientId must be used within a ClientIdProvider');
  }
  return context;
};
