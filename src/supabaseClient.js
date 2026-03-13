import { createClient } from '@supabase/supabase-js'
console.log("URL 체크:", import.meta.env.VITE_SUPABASE_URL);
// import.meta.env를 통해 .env 파일의 내용을 가져옵니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)