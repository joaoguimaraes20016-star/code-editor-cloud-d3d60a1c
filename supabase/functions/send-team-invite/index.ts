import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  teamId: string;
  email: string;
  role: string;
  teamName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { teamId, email, role, teamName }: InviteRequest = await req.json();

    // Generate a unique token
    const inviteToken = crypto.randomUUID();

    // Create invitation record
    const { error: inviteError } = await supabase
      .from("team_invitations")
      .insert({
        team_id: teamId,
        email: email.toLowerCase(),
        token: inviteToken,
        role: role,
        invited_by: user.id,
      });

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      throw inviteError;
    }

    // Use custom domain for invite URLs
    const inviteUrl = `https://grwthengine.com/?invite=${inviteToken}`;
    
    console.log('Generated invite URL:', inviteUrl);
    
    // Optional: Send email with Resend if API key is configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Team Invites <invites@notifications.grwthengine.org>",
            to: [email],
            subject: `You've been invited to join ${teamName}`,
            html: `
              <h1>You've been invited to join ${teamName}</h1>
              <p>You've been invited to join the team "${teamName}" as a ${role}.</p>
              <p>Click the link below to accept the invitation and create your account:</p>
              <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Accept Invitation</a>
              <p>Or copy and paste this link into your browser:</p>
              <p>${inviteUrl}</p>
              <p>This invitation will expire in 7 days.</p>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Error sending email:", await emailResponse.text());
        }
      } catch (error) {
        console.error("Failed to send email:", error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        token: inviteToken,
        inviteUrl: inviteUrl,
        emailSent: !!resendApiKey
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-team-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
