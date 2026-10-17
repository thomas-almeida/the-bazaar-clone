"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { playEvent } from "@/lib/sfx";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  user: User | null;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateLastMage: (mageId: string) => Promise<void>;
  markTutorialDone: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let alive = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.error("Unable to restore Supabase auth session:", error);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) throw new Error("O Supabase Auth não está configurado. Confira as variáveis públicas no ambiente.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) throw error;
    if (data.session) {
      setUser(data.user);
      playEvent("event:login");
    }
    return data.session !== null;
  }, [supabase]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("O Supabase Auth não está configurado. Confira as variáveis públicas no ambiente.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setUser(data.user);
    playEvent("event:login");
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error("O Supabase Auth não está configurado.");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    playEvent("event:login");
  }, [supabase]);

  const updateLastMage = useCallback(async (mageId: string) => {
    if (!supabase || !user) throw new Error("Entre na sua conta para iniciar uma run.");
    const { data, error } = await supabase.auth.updateUser({
      data: { ...user.user_metadata, last_mage_id: mageId },
    });
    if (error) throw error;
    setUser(data.user);
  }, [supabase, user]);

  // Marca o tutorial como concluído no perfil. Silencioso: se falhar (sem rede,
  // sem Supabase), não atrapalha o jogo — o tutorial apenas não fica lembrado.
  const markTutorialDone = useCallback(async () => {
    if (!supabase || !user || user.user_metadata?.tutorial_done) return;
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { ...user.user_metadata, tutorial_done: true },
      });
      if (!error && data.user) setUser(data.user);
    } catch {
      /* ignora: concluir o tutorial nunca deve travar o jogo */
    }
  }, [supabase, user]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: supabase !== null,
    loading,
    user,
    signUp,
    signIn,
    signOut,
    updateLastMage,
    markTutorialDone,
  }), [loading, markTutorialDone, signIn, signOut, signUp, supabase, updateLastMage, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
