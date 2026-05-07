import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY  // server-side only — never expose to client

if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] ⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — DB features disabled')
}

const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null

export default supabase
