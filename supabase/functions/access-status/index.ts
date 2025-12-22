import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey || !supabaseAnonKey) {
      throw new Error('Missing SUPABASE_URL, SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY');
    }

    // Use anon key + user token to validate the caller
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role (no user token) for RPCs that require service_role
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const intent = body?.intent ?? 'status';
    const timezone = body?.timezone ?? null;

    if (intent === 'start_trial') {
      const { data, error } = await supabaseAdmin.rpc('start_trial_for_user', {
        p_user_id: user.id,
        p_timezone: timezone,
      });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message ?? 'Failed to start trial' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default intent: fetch access status (no increment)
    const { data, error } = await supabaseAdmin.rpc('get_access_status', {
      p_user_id: user.id,
      p_timezone: timezone,
      p_increment: false,
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message ?? 'Failed to fetch access status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
