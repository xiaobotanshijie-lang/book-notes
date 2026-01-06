import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnoqhuiyuafdnxmuxgvg.supabase.co';
const supabaseAnonKey = 'sb_publishable_mbwIC_npzR9Coq8oFTMJgQ___NU_01k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
