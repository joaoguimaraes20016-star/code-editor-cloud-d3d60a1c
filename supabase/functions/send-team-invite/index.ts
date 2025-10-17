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

    // Use custom domain for invite URLs - point directly to auth page
    const inviteUrl = `https://grwthengine.com/auth?invite=${inviteToken}`;
    
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
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Team Invitation</title>
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
                    <tr>
                      <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                          <!-- Header -->
                          <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center;">
                              <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">You're Invited!</h1>
                            </td>
                          </tr>
                          
                          <!-- Content -->
                          <tr>
                            <td style="padding: 0 40px 30px 40px;">
                              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 24px;">
                                You've been invited to join <strong>${teamName}</strong> on GRWTH Engine as a <strong>${role}</strong>.
                              </p>
                              <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 24px;">
                                Click the button below to accept your invitation and get started:
                              </p>
                              
                              <!-- Accept Button -->
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" style="padding: 0 0 30px 0;">
                                    <a href="${inviteUrl}" style="display: inline-block; padding: 16px 40px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Accept Invitation</a>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 20px;">
                                Or copy and paste this link into your browser:
                              </p>
                              <p style="margin: 0 0 30px 0; color: #6366f1; font-size: 14px; line-height: 20px; word-break: break-all;">
                                ${inviteUrl}
                              </p>
                              
                              <div style="padding: 20px; background-color: #fef3c7; border-radius: 6px; margin-bottom: 20px;">
                                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                                  ⏰ This invitation will expire in 7 days.
                                </p>
                              </div>
                              
                              <p style="margin: 0; color: #6b6b6b; font-size: 14px; line-height: 20px;">
                                If you weren't expecting this invitation, you can safely ignore this email.
                              </p>
                            </td>
                          </tr>
                          
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 30px 40px 40px 40px; border-top: 1px solid #e5e5e5;">
                              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 18px; text-align: center;">
                                © ${new Date().getFullYear()} GRWTH Engine. All rights reserved.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
              </html>
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
