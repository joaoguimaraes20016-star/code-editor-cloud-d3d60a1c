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
                  <title>Team Invitation - GRWTH Engine</title>
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
                    <tr>
                      <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #000000; border-radius: 12px; border: 2px solid #ffc107; box-shadow: 0 0 40px rgba(255, 193, 7, 0.15);">
                          
                          <!-- Logo Header -->
                          <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #000000; border-radius: 12px 12px 0 0;">
                              <img src="https://grwthengine.com/logo.png" alt="GRWTH Engine Logo" style="width: 80px; height: 80px; margin-bottom: 20px;" />
                              <h1 style="margin: 0; color: #ffc107; font-size: 32px; font-weight: 700; text-shadow: 0 0 20px rgba(255, 193, 7, 0.3);">You're Invited!</h1>
                            </td>
                          </tr>
                          
                          <!-- Content -->
                          <tr>
                            <td style="padding: 20px 40px 40px 40px; background-color: #000000;">
                              <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 17px; line-height: 26px;">
                                You've been invited to join <strong style="color: #ffc107;">${teamName}</strong> on GRWTH Engine as a <strong style="color: #ffc107;">${role}</strong>.
                              </p>
                              <p style="margin: 0 0 30px 0; color: #b0b0b0; font-size: 16px; line-height: 24px;">
                                Click the button below to accept your invitation and start tracking your sales performance:
                              </p>
                              
                              <!-- Accept Button -->
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" style="padding: 0 0 30px 0;">
                                    <a href="${inviteUrl}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #ffc107 0%, #ffb300 100%); color: #000000; text-decoration: none; border-radius: 8px; font-size: 17px; font-weight: 700; box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3); border: 2px solid #ffc107;">Accept Invitation</a>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 0 0 15px 0; color: #909090; font-size: 14px; line-height: 20px;">
                                Or copy and paste this link into your browser:
                              </p>
                              <div style="padding: 15px; background-color: #1a1a1a; border-radius: 6px; margin-bottom: 30px; border: 1px solid #333;">
                                <p style="margin: 0; color: #ffc107; font-size: 13px; line-height: 20px; word-break: break-all; font-family: monospace;">
                                  ${inviteUrl}
                                </p>
                              </div>
                              
                              <div style="padding: 20px; background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0.05) 100%); border-radius: 8px; margin-bottom: 25px; border: 1px solid rgba(255, 193, 7, 0.3);">
                                <p style="margin: 0; color: #ffc107; font-size: 14px; line-height: 22px;">
                                  ⏰ <strong>Important:</strong> This invitation will expire in 7 days.
                                </p>
                              </div>
                              
                              <p style="margin: 0; color: #707070; font-size: 14px; line-height: 20px;">
                                If you weren't expecting this invitation, you can safely ignore this email.
                              </p>
                            </td>
                          </tr>
                          
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 30px 40px 40px 40px; border-top: 2px solid #ffc107; background-color: #000000; border-radius: 0 0 12px 12px;">
                              <p style="margin: 0 0 10px 0; color: #ffc107; font-size: 16px; line-height: 24px; text-align: center; font-weight: 600;">
                                GRWTH Engine
                              </p>
                              <p style="margin: 0; color: #606060; font-size: 12px; line-height: 18px; text-align: center;">
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
