// supabase/functions/publish-funnel/index.ts
// Canonical Funnel Publishing Endpoint
// - Backend is the source of truth for funnels
// - Authenticated via Authorization header (user JWT)
// - Idempotent, explicit publishing (no partial writes of steps)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PublishFunnelStepInput {
  id?: string;
  order_index?: number;
  step_type?: string;
  content?: unknown;
}

interface PublishFunnelInput {
  funnel_id: string;
  name?: string;
  steps: PublishFunnelStepInput[];
}

function isUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("[publish-funnel] Missing SUPABASE_URL or SUPABASE_ANON_KEY env");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[publish-funnel] Auth failed", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const rawBody = (await req.json()) as PublishFunnelInput;

    const funnel_id = rawBody?.funnel_id;
    const name = rawBody?.name;
    const steps = Array.isArray(rawBody?.steps) ? rawBody.steps : [];

    if (!funnel_id || typeof funnel_id !== "string" || !isUuid(funnel_id)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid funnel_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid name" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!Array.isArray(steps)) {
      return new Response(
        JSON.stringify({ error: "steps must be an array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Confirm funnel exists and is owned by the authenticated user
    const { data: funnel, error: fetchFunnelError } = await supabase
      .from("funnels")
      .select("id, created_by")
      .eq("id", funnel_id)
      .single();

    if (fetchFunnelError) {
      console.error("[publish-funnel] Error fetching funnel:", fetchFunnelError);
      return new Response(
        JSON.stringify({ error: "Funnel not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!funnel || funnel.created_by !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: updateFunnelError } = await supabase
      .from("funnels")
      .update({
        name: name.trim(),
        status: "published",
        updated_at: new Date().toISOString(),
      })
      .eq("id", funnel_id);

    if (updateFunnelError) {
      console.error("[publish-funnel] Error updating funnel:", updateFunnelError);
      return new Response(
        JSON.stringify({ error: "Failed to update funnel" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalize steps and publish: delete existing, then insert new set.
    const { error: deleteError } = await supabase
      .from("funnel_steps")
      .delete()
      .eq("funnel_id", funnel_id);

    if (deleteError) {
      console.error("[publish-funnel] Error deleting existing funnel_steps:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to reset funnel steps" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stepRows = steps.map((step, index) => {
      const step_type =
        typeof step?.step_type === "string" && step.step_type.trim().length > 0
          ? step.step_type
          : "welcome";

      const rawContent = step?.content;
      const content =
        rawContent && typeof rawContent === "object" && !Array.isArray(rawContent)
          ? rawContent
          : {};

      return {
        funnel_id,
        order_index: index,
        step_type,
        content,
      };
    });

    if (stepRows.length > 0) {
      const { error: insertError } = await supabase
        .from("funnel_steps")
        .insert(stepRows);

      if (insertError) {
        console.error("[publish-funnel] Error inserting funnel_steps:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to persist funnel steps" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, funnel_id, updated_step_count: stepRows.length }),
      {
      status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[publish-funnel] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
