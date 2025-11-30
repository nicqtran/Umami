import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

const TOKEN_KEY = 'supabase.tokens';

const getStoredTokens = async (): Promise<{ access_token: string; refresh_token: string } | null> => {
  const stored = await AsyncStorage.getItem(TOKEN_KEY);
  return stored ? (JSON.parse(stored) as { access_token: string; refresh_token: string }) : null;
};

const storeTokens = async (session: Session | null) => {
  if (session?.access_token && session?.refresh_token) {
    await AsyncStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })
    );
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
};

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const storedTokens = await getStoredTokens();
        if (storedTokens) {
          const { data } = await supabase.auth.setSession(storedTokens);
          setSession(data.session ?? null);
          return;
        }
        const { data } = await supabase.auth.getSession();
        setSession(data.session ?? null);
      } finally {
        setLoading(false);
      }
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      await storeTokens(sess);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user, loading };
}
