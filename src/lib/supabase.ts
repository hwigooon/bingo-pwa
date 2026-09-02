import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("온라인 게임 설정이 아직 연결되지 않았습니다.");
  }
  return supabase;
}

export async function ensureUserId(): Promise<string> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user.id) return sessionData.session.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    throw new Error(
      "익명 참가 연결에 실패했습니다. Supabase에서 Anonymous Sign-Ins가 활성화되어 있는지 확인해 주세요.",
    );
  }
  if (!data.user?.id) throw new Error("사용자 식별 정보를 만들지 못했습니다.");
  return data.user.id;
}
