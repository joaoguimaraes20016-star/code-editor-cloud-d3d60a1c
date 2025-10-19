import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();
    console.log("Password reset requested for:", email);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    const user = userData?.users?.find(u => u.email === email);

    if (!user) {
      console.log("User not found:", email);
      // Return success even if user doesn't exist (security best practice)
      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate secure random token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database
    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        email: email,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing reset token:", insertError);
      throw new Error("Failed to create reset token");
    }

    // Generate reset link
    const resetLink = `${Deno.env.get("SITE_URL") || "https://grwthop.com"}/reset-password?token=${token}`;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "GRWTH OP <onboarding@resend.dev>",
      to: [email],
      subject: "Reset Your GRWTH OP Password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px 40px; text-align: center;">
                        <img src="https://grwthop.com/logo.png" alt="GRWTH OP Logo" style="width: 80px; height: 80px; margin-bottom: 20px;" />
                        <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">Reset Your Password</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 0 40px 30px 40px;">
                        <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 24px;">
                          We received a request to reset your password for your GRWTH OP account.
                        </p>
                        <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 24px;">
                          Click the button below to reset your password:
                        </p>
                        
                        <!-- Reset Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 0 0 30px 0;">
                              <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Reset Password</a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 20px;">
                          Or copy and paste this link into your browser:
                        </p>
                        <p style="margin: 0 0 30px 0; color: #6366f1; font-size: 14px; line-height: 20px; word-break: break-all;">
                          ${resetLink}
                        </p>
                        
                        <div style="padding: 20px; background-color: #fef3c7; border-radius: 6px; margin-bottom: 20px;">
                          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                            ⏰ This link will expire in 1 hour for security reasons.
                          </p>
                        </div>
                        
                        <p style="margin: 0; color: #6b6b6b; font-size: 14px; line-height: 20px;">
                          If you didn't request a password reset, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px 40px 40px; border-top: 1px solid #e5e5e5;">
                        <p style="margin: 0; color: #999999; font-size: 12px; line-height: 18px; text-align: center;">
                          © ${new Date().getFullYear()} GRWTH OP. All rights reserved.
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
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
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
