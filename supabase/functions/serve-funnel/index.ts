import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FunnelStep {
  id: string;
  order_index: number;
  step_type: string;
  content: Record<string, any>;
}

interface FunnelSettings {
  logo_url?: string;
  primary_color: string;
  background_color: string;
  button_text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let domain: string | null = url.searchParams.get('domain');
    
    console.log(`Request method: ${req.method}`);
    console.log(`Query param domain: ${domain}`);
    console.log(`X-Forwarded-Host: ${req.headers.get('x-forwarded-host')}`);
    console.log(`Host: ${req.headers.get('host')}`);
    
    if (!domain) {
      domain = req.headers.get('x-forwarded-host') || req.headers.get('host');
    }
    
    if (!domain && req.method === 'POST') {
      try {
        const body = await req.json();
        domain = body.domain;
        console.log(`Domain from POST body: ${domain}`);
      } catch (e) {
        console.log('Failed to parse JSON body:', e);
      }
    }
    
    if (!domain) {
      return new Response(
        generateErrorPage('Configuration Error', 'Domain could not be determined from request.'),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').split(':')[0];
    console.log(`Serving funnel for domain: ${cleanDomain}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: domainRecord, error: domainError } = await supabase
      .from('funnel_domains')
      .select('id, domain, status, ssl_provisioned, team_id')
      .eq('domain', cleanDomain)
      .eq('status', 'verified')
      .single();

    if (domainError || !domainRecord) {
      console.log(`Domain not found or not verified: ${cleanDomain}`);
      return new Response(
        generateErrorPage('Domain Not Found', 'This domain is not configured or not verified.'),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id, name, slug, status, settings, team_id')
      .eq('domain_id', domainRecord.id)
      .eq('status', 'published')
      .single();

    if (funnelError || !funnel) {
      console.log(`No published funnel found for domain: ${cleanDomain}`);
      return new Response(
        generateErrorPage('No Funnel', 'No funnel is linked to this domain.'),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    const { data: steps, error: stepsError } = await supabase
      .from('funnel_steps')
      .select('*')
      .eq('funnel_id', funnel.id)
      .order('order_index', { ascending: true });

    if (stepsError || !steps || steps.length === 0) {
      console.log(`No steps found for funnel: ${funnel.slug}`);
      return new Response(
        generateErrorPage('Empty Funnel', 'This funnel has no content.'),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    const settings = funnel.settings as FunnelSettings;
    const html = generateFunnelHTML(funnel, steps, settings, cleanDomain);

    console.log(`Serving funnel ${funnel.slug} for domain ${cleanDomain}`);
    console.log(`HTML length: ${html.length} bytes`);

    const response = new Response(html, { 
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
    
    return response;

  } catch (error: unknown) {
    console.error('Serve funnel error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      generateErrorPage('Error', errorMessage),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});

function generateErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsonForScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
}

function generateFunnelHTML(
  funnel: { id: string; slug: string; name: string; team_id: string },
  steps: FunnelStep[],
  settings: FunnelSettings,
  domain: string
): string {
  const funnelData = escapeJsonForScript({
    id: funnel.id,
    slug: funnel.slug,
    name: funnel.name,
    team_id: funnel.team_id,
    settings,
  });
  const stepsData = escapeJsonForScript(steps);
  const primaryColor = settings.primary_color || '#22c55e';
  const bgColor = settings.background_color || '#0a0a0a';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="${bgColor}">
  <title>${escapeHtml(funnel.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      min-height: 100vh;
      background: ${bgColor};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }
    
    #funnel-root {
      min-height: 100vh;
      width: 100%;
    }
    
    .loading-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .spinner {
      width: 32px;
      height: 32px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .step-container {
      min-height: 100vh;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 4rem 1rem 2rem;
    }
    
    .step-content {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      text-align: center;
    }
    
    .logo {
      position: fixed;
      top: 1rem;
      left: 1rem;
      z-index: 100;
    }
    
    .logo img {
      height: 24px;
      width: auto;
      object-fit: contain;
    }
    
    @media (min-width: 768px) {
      .logo { top: 1.5rem; left: 1.5rem; }
      .logo img { height: 32px; }
      .step-container { padding: 5rem 1.5rem 2rem; }
    }
    
    .progress-dots {
      position: fixed;
      top: 1rem;
      right: 1rem;
      display: flex;
      gap: 6px;
      z-index: 100;
    }
    
    @media (min-width: 768px) {
      .progress-dots { top: 1.5rem; right: 1.5rem; }
    }
    
    .progress-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      transition: all 0.3s ease;
    }
    
    .progress-dot.active {
      background: ${primaryColor};
      box-shadow: 0 0 8px ${primaryColor}60;
    }
    
    .progress-dot.completed {
      background: ${primaryColor};
    }
    
    /* Dynamic Elements - with font family support */
    .element-headline {
      color: white;
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 1rem;
      text-align: center;
    }
    
    @media (min-width: 768px) {
      .element-headline { font-size: 2.5rem; }
    }
    
    .element-text {
      color: rgba(255,255,255,0.9);
      font-size: 1rem;
      line-height: 1.6;
      text-align: center;
      margin-bottom: 1rem;
    }
    
    .element-subheadline {
      color: rgba(255,255,255,0.7);
      font-size: 1rem;
      line-height: 1.5;
      text-align: center;
      margin-bottom: 1.5rem;
    }
    
    .element-button {
      display: block;
      width: 100%;
      max-width: 400px;
      margin: 0 auto 1rem;
      padding: 1rem 2rem;
      background: ${primaryColor};
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1.125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      text-decoration: none;
    }
    
    /* Button hover effects */
    .element-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.3);
    }
    
    .element-button.hover-glow:hover {
      box-shadow: 0 0 30px var(--btn-glow-color, ${primaryColor}80);
    }
    
    .element-button.hover-lift:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.4);
    }
    
    .element-button.hover-pulse:hover {
      animation: pulse 0.5s ease-in-out;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    
    .element-image {
      width: 100%;
      max-width: 100%;
      border-radius: 12px;
      margin-bottom: 1rem;
    }
    
    .element-video {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 12px;
      overflow: hidden;
      background: rgba(0,0,0,0.5);
      margin-bottom: 1.5rem;
    }
    
    .element-video iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    
    .element-divider {
      width: 100%;
      height: 1px;
      background: rgba(255,255,255,0.1);
      margin: 1.5rem 0;
    }
    
    .element-embed {
      width: 100%;
      min-height: 500px;
      border-radius: 12px;
      overflow: hidden;
      background: white;
      margin-bottom: 1rem;
    }
    
    .element-embed iframe {
      width: 100%;
      height: 100%;
      border: none;
      min-height: 500px;
    }
    
    /* Styled input containers - matching React exactly */
    .styled-input-container {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      margin-bottom: 1rem;
      transition: all 0.2s ease;
    }
    
    .styled-input-container:focus-within {
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px ${primaryColor}20;
    }
    
    .styled-input-container .input-icon {
      color: #9ca3af;
      font-size: 1.25rem;
      margin-top: 2px;
      flex-shrink: 0;
    }
    
    .styled-input-container input,
    .styled-input-container textarea {
      flex: 1;
      border: none;
      background: transparent;
      color: #0a0a0a;
      font-size: 1rem;
      outline: none;
    }
    
    .styled-input-container textarea {
      resize: none;
      min-height: 80px;
    }
    
    .styled-input-container input::placeholder,
    .styled-input-container textarea::placeholder {
      color: #9ca3af;
    }
    
    /* Legacy input fields fallback */
    .input-field {
      width: 100%;
      padding: 1rem;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      color: white;
      font-size: 1rem;
      margin-bottom: 1rem;
      outline: none;
      transition: all 0.2s ease;
    }
    
    .input-field:focus {
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px ${primaryColor}20;
    }
    
    .input-field::placeholder {
      color: rgba(255,255,255,0.5);
    }
    
    /* Option cards - matching React exactly */
    .option-card {
      width: 100%;
      padding: 1rem 1.25rem;
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .option-card:hover {
      border-color: rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.08);
    }
    
    .option-card.selected {
      border-color: ${primaryColor};
      background: ${primaryColor}15;
    }
    
    .option-icon { font-size: 1.5rem; }
    .option-label { color: white; font-size: 1rem; font-weight: 500; flex: 1; text-align: left; }
    
    .option-radio {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .option-card.selected .option-radio { border-color: ${primaryColor}; }
    
    .option-radio-inner {
      width: 10px;
      height: 10px;
      background: ${primaryColor};
      border-radius: 50%;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .option-card.selected .option-radio-inner { opacity: 1; }
    
    .question-counter {
      color: rgba(255,255,255,0.5);
      font-size: 0.875rem;
      text-align: center;
      margin-bottom: 1.5rem;
    }
    
    /* Privacy checkbox */
    .privacy-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin: 1rem 0;
      color: rgba(255,255,255,0.7);
      font-size: 0.875rem;
    }
    
    .privacy-checkbox {
      width: 18px;
      height: 18px;
      margin-top: 2px;
      accent-color: ${primaryColor};
      flex-shrink: 0;
    }
    
    .privacy-text a {
      color: ${primaryColor};
      text-decoration: underline;
    }
    
    .step-hidden { display: none; }
    
    .press-enter-hint {
      color: rgba(255,255,255,0.4);
      font-size: 0.875rem;
      text-align: center;
      margin-top: 0.5rem;
    }
    
    .element-hint {
      color: rgba(255,255,255,0.6);
      font-size: 0.9rem;
      text-align: center;
      margin-top: 0.5rem;
    }
    
    .fade-in {
      animation: fadeIn 0.3s ease forwards;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Error styling */
    .error-message {
      color: #f87171;
      font-size: 0.75rem;
      margin-top: -0.5rem;
      margin-bottom: 0.5rem;
      display: none;
    }
    
    .input-error {
      border-color: #ef4444 !important;
    }
  </style>
</head>
<body>
  <div id="funnel-root">
    <div class="loading-container">
      <div class="spinner"></div>
    </div>
  </div>
  
  <script>
    const FUNNEL_DATA = ${funnelData};
    const STEPS_DATA = ${stepsData};
    const SUPABASE_URL = '${Deno.env.get('SUPABASE_URL')}';
    const SUPABASE_ANON_KEY = '${Deno.env.get('SUPABASE_ANON_KEY')}';
    
    let currentStepIndex = 0;
    let answers = {};
    let leadId = null;
    let calendlyBookingData = null;
    
    document.addEventListener('DOMContentLoaded', function() {
      try {
        console.log('Funnel data:', FUNNEL_DATA);
        console.log('Steps data:', STEPS_DATA);
        renderFunnel();
        setupCalendlyListener();
      } catch (error) {
        console.error('Error initializing funnel:', error);
        document.getElementById('funnel-root').innerHTML = 
          '<div style="color: white; padding: 2rem; text-align: center;">' +
          '<h2>Error Loading Funnel</h2>' +
          '<p style="color: #888;">Please try refreshing the page.</p>' +
          '<pre style="color: #666; font-size: 0.75rem; margin-top: 1rem; text-align: left; overflow-x: auto;">' + error.message + '</pre>' +
          '</div>';
      }
    });
    
    function setupCalendlyListener() {
      window.addEventListener('message', function(event) {
        if (event.data.event === 'calendly.event_scheduled') {
          console.log('Calendly booking detected:', event.data);
          calendlyBookingData = {
            event_time: event.data.payload?.event?.start_time,
            event_type: event.data.payload?.event_type?.name,
            invitee_uri: event.data.payload?.invitee?.uri,
            scheduling_url: event.data.payload?.event?.scheduling_url,
          };
          saveLead();
          setTimeout(function() { goToNextStep(); }, 1500);
        }
      });
    }
    
    function renderFunnel() {
      var root = document.getElementById('funnel-root');
      var settings = FUNNEL_DATA.settings || {};
      
      var dotsHTML = STEPS_DATA.map(function(_, index) {
        return '<div class="progress-dot ' + (index === 0 ? 'active' : '') + '" data-index="' + index + '"></div>';
      }).join('');
      
      var logoHTML = settings.logo_url 
        ? '<div class="logo"><img src="' + settings.logo_url + '" alt="Logo"></div>' 
        : '';
      
      var stepsHTML = STEPS_DATA.map(function(step, index) {
        return '<div class="step-container ' + (index !== 0 ? 'step-hidden' : 'fade-in') + '" data-step-index="' + index + '">' +
          '<div class="step-content">' + renderStepContent(step, index) + '</div>' +
        '</div>';
      }).join('');
      
      root.innerHTML = logoHTML + '<div class="progress-dots">' + dotsHTML + '</div>' + stepsHTML;
    }
    
    function renderStepContent(step, index) {
      var content = step.content || {};
      var type = step.step_type;
      
      if (content.element_order && Array.isArray(content.element_order) && content.element_order.length > 0) {
        return renderDynamicElements(content, index, type);
      }
      
      switch (type) {
        case 'welcome': return renderWelcome(content);
        case 'text_question': return renderTextQuestion(content, index);
        case 'multi_choice': return renderMultiChoice(content, index);
        case 'email_capture': return renderEmailCapture(content);
        case 'phone_capture': return renderPhoneCapture(content);
        case 'opt_in': return renderOptIn(content);
        case 'video': return renderVideo(content);
        case 'embed': return renderEmbed(content);
        case 'thank_you': return renderThankYou(content);
        default: return '<p style="color: white;">Step: ' + type + '</p>';
      }
    }
    
    function getButtonStyle(design) {
      var settings = FUNNEL_DATA.settings || {};
      var primaryColor = settings.primary_color || '#22c55e';
      var style = '';
      var hoverClass = '';
      
      if (design && design.useButtonGradient && design.buttonGradientFrom && design.buttonGradientTo) {
        var direction = design.buttonGradientDirection || '135deg';
        style = 'background: linear-gradient(' + direction + ', ' + design.buttonGradientFrom + ', ' + design.buttonGradientTo + ');';
      } else if (design && design.buttonColor) {
        style = 'background: ' + design.buttonColor + ';';
      }
      
      if (design && design.buttonTextColor) {
        style += ' color: ' + design.buttonTextColor + ';';
      }
      
      if (design && design.borderRadius) {
        style += ' border-radius: ' + design.borderRadius + 'px;';
      }
      
      if (design && design.fontFamily) {
        style += ' font-family: ' + design.fontFamily + ';';
      }
      
      if (design && design.buttonHoverEffect) {
        hoverClass = ' hover-' + design.buttonHoverEffect;
      }
      
      return { style: style, hoverClass: hoverClass };
    }
    
    function renderDynamicElements(content, stepIndex, stepType) {
      var elementOrder = content.element_order || [];
      var dynamicElements = content.dynamic_elements || {};
      var design = content.design || {};
      var html = '';
      
      var btnStyle = getButtonStyle(design);
      var questionId = 'question_' + stepIndex;
      var inputIcon = content.input_icon || '💬';
      
      for (var i = 0; i < elementOrder.length; i++) {
        var elementId = elementOrder[i];
        
        if (elementId === 'headline' && content.headline) {
          var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
          html += '<div class="element-headline" style="' + fontStyle + '">' + content.headline + '</div>';
        } else if (elementId === 'subheadline' && content.subheadline) {
          html += '<div class="element-subheadline">' + content.subheadline + '</div>';
        } else if (elementId === 'subtext' && content.subtext) {
          html += '<div class="element-subheadline">' + content.subtext + '</div>';
        } else if (elementId === 'button') {
          html += '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleNext()">' + (content.button_text || design.buttonText || 'Continue') + '</button>';
        } else if (elementId === 'video' && content.video_url) {
          html += renderVideoElement(content.video_url);
        } else if (elementId === 'input') {
          html += renderInputForStep(stepType, content, design, stepIndex);
        } else if (elementId === 'options' && content.options) {
          html += renderOptionsHTML(content.options, stepIndex, design);
          html += '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleMultiChoiceSubmit(' + stepIndex + ')">' + (content.next_button_text || content.button_text || 'Next Question') + '</button>';
        } else if (elementId === 'hint' && content.hint) {
          html += '<div class="element-hint">' + content.hint + '</div>';
        } else if (elementId === 'image_top' && content.image_top_url) {
          html += '<img class="element-image" src="' + content.image_top_url + '" alt="">';
        } else if (dynamicElements[elementId]) {
          html += renderDynamicElement(elementId, dynamicElements[elementId], design);
        } else if (elementId.startsWith('divider')) {
          html += '<div class="element-divider"></div>';
        }
      }
      
      return html;
    }
    
    function renderInputForStep(stepType, content, design, stepIndex) {
      var inputBg = (design && design.inputBg) || '#ffffff';
      var inputTextColor = (design && design.inputTextColor) || '#0a0a0a';
      var inputBorder = (design && design.inputBorder) || '#e5e7eb';
      var inputBorderWidth = (design && design.inputBorderWidth) || 1;
      var inputRadius = (design && design.inputRadius) || 12;
      var inputPlaceholderColor = (design && design.inputPlaceholderColor) || '#9ca3af';
      var showInputIcon = design ? design.inputShowIcon !== false : true;
      
      var containerStyle = 'display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; background: ' + inputBg + '; border: ' + inputBorderWidth + 'px solid ' + inputBorder + '; border-radius: ' + inputRadius + 'px; margin-bottom: 1rem;';
      var fieldStyle = 'flex: 1; border: none; background: transparent; color: ' + inputTextColor + '; font-size: 1rem; outline: none;';
      var questionId = 'question_' + stepIndex;
      var btnStyle = getButtonStyle(design);
      
      var html = '<div class="styled-input-container" style="' + containerStyle + '">';
      if (showInputIcon) {
        html += '<span class="input-icon" style="color: ' + inputPlaceholderColor + ';">💬</span>';
      }
      html += '<textarea id="' + questionId + '" style="' + fieldStyle + ' resize: none; min-height: 80px;" placeholder="' + (content.placeholder || 'Type your answer...') + '" onkeydown="if(event.key===\\'Enter\\' && !event.shiftKey){event.preventDefault();handleTextSubmit(\\'' + questionId + '\\');}"></textarea>';
      html += '</div>';
      html += '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleTextSubmit(\\'' + questionId + '\\')">' + (content.submit_button_text || content.button_text || 'Submit') + '</button>';
      html += '<div class="press-enter-hint">Press Enter ↵</div>';
      
      return html;
    }
    
    function renderOptionsHTML(options, stepIndex, design) {
      var html = '<div class="options-container" style="margin-bottom: 1rem;">';
      for (var i = 0; i < options.length; i++) {
        var opt = options[i];
        var label = typeof opt === 'string' ? opt : (opt.label || opt.text || '');
        var emoji = typeof opt === 'object' ? (opt.emoji || opt.icon || '') : '';
        var safeLabel = String(label).replace(/'/g, "\\\\'");
        
        html += '<div class="option-card" onclick="selectOption(this, ' + stepIndex + ', \\'' + safeLabel + '\\')">';
        if (emoji) html += '<span class="option-icon">' + emoji + '</span>';
        html += '<span class="option-label">' + label + '</span>';
        html += '<div class="option-radio"><div class="option-radio-inner"></div></div>';
        html += '</div>';
      }
      html += '</div>';
      return html;
    }
    
    function renderDynamicElement(elementId, element, design) {
      var btnStyle = getButtonStyle(design);
      var fontStyle = design && design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      if (elementId.startsWith('text_')) {
        return '<div class="element-text" style="' + fontStyle + '">' + (element.text || '') + '</div>';
      } else if (elementId.startsWith('headline_')) {
        return '<div class="element-headline" style="' + fontStyle + '">' + (element.text || '') + '</div>';
      } else if (elementId.startsWith('button_')) {
        var btnText = element.text || 'Continue';
        var elStyle = btnStyle.style;
        if (element.gradient_from && element.gradient_to) {
          elStyle = 'background: linear-gradient(135deg, ' + element.gradient_from + ', ' + element.gradient_to + ');';
        }
        return '<button class="element-button' + btnStyle.hoverClass + '" style="' + elStyle + '" onclick="handleNext()">' + btnText + '</button>';
      } else if (elementId.startsWith('image_')) {
        if (element.image_url) {
          return '<img class="element-image" src="' + element.image_url + '" alt="">';
        }
        return '';
      } else if (elementId.startsWith('video_')) {
        return renderVideoElement(element.video_url || '');
      } else if (elementId.startsWith('embed_')) {
        var scale = element.embed_scale || element.scale || 0.75;
        return '<div class="element-embed" style="transform: scale(' + scale + '); transform-origin: top center;">' +
          '<iframe src="' + (element.embed_url || '') + '" allow="camera; microphone"></iframe>' +
        '</div>';
      } else if (elementId.startsWith('divider')) {
        return '<div class="element-divider"></div>';
      }
      return '';
    }
    
    function renderVideoElement(videoUrl) {
      if (!videoUrl) return '';
      var embedUrl = getVideoEmbedUrl(videoUrl);
      if (embedUrl) {
        return '<div class="element-video"><iframe src="' + embedUrl + '" allowfullscreen allow="autoplay; fullscreen"></iframe></div>';
      }
      return '';
    }
    
    function getVideoEmbedUrl(url) {
      if (!url) return '';
      
      // YouTube
      if (url.indexOf('youtube.com') !== -1 || url.indexOf('youtu.be') !== -1) {
        var vidId = '';
        if (url.indexOf('v=') !== -1) {
          vidId = url.split('v=')[1];
          var ampPos = vidId.indexOf('&');
          if (ampPos !== -1) vidId = vidId.substring(0, ampPos);
        } else if (url.indexOf('youtu.be/') !== -1) {
          vidId = url.split('youtu.be/')[1];
          var qPos = vidId.indexOf('?');
          if (qPos !== -1) vidId = vidId.substring(0, qPos);
        }
        if (vidId) return 'https://www.youtube.com/embed/' + vidId;
      }
      // Vimeo
      else if (url.indexOf('vimeo.com') !== -1) {
        var parts = url.split('/');
        var vimeoId = parts[parts.length - 1].split('?')[0];
        if (vimeoId) return 'https://player.vimeo.com/video/' + vimeoId;
      }
      // Loom
      else if (url.indexOf('loom.com') !== -1) {
        if (url.indexOf('/share/') !== -1) {
          var loomId = url.split('/share/')[1].split('?')[0];
          if (loomId) return 'https://www.loom.com/embed/' + loomId;
        } else if (url.indexOf('/embed/') !== -1) {
          return url;
        }
      }
      // Wistia
      else if (url.indexOf('wistia.com') !== -1 || url.indexOf('wistia.net') !== -1) {
        if (url.indexOf('/medias/') !== -1) {
          var wistiaId = url.split('/medias/')[1].split('?')[0].split('/')[0];
          if (wistiaId) return 'https://fast.wistia.net/embed/iframe/' + wistiaId;
        } else if (url.indexOf('/embed/iframe/') !== -1) {
          return url;
        }
      }
      
      if (url.indexOf('/embed/') !== -1 || url.indexOf('/embed?') !== -1) {
        return url;
      }
      
      return '';
    }
    
    function renderWelcome(content) {
      var design = content.design || {};
      var btnStyle = getButtonStyle(design);
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      return '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || 'Welcome') + '</div>' +
        (content.subheadline ? '<div class="element-subheadline">' + content.subheadline + '</div>' : '') +
        (content.subtext ? '<div class="element-subheadline">' + content.subtext + '</div>' : '') +
        '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleNext()">' + (content.button_text || 'Get Started') + '</button>';
    }
    
    function renderTextQuestion(content, index) {
      var design = content.design || {};
      var btnStyle = getButtonStyle(design);
      var questionId = 'question_' + index;
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      var inputBg = design.inputBg || '#ffffff';
      var inputTextColor = design.inputTextColor || '#0a0a0a';
      var inputBorder = design.inputBorder || '#e5e7eb';
      var inputRadius = design.inputRadius || 12;
      var inputPlaceholderColor = design.inputPlaceholderColor || '#9ca3af';
      var showInputIcon = design.inputShowIcon !== false;
      
      var containerStyle = 'display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; background: ' + inputBg + '; border: 1px solid ' + inputBorder + '; border-radius: ' + inputRadius + 'px; margin-bottom: 1rem;';
      var fieldStyle = 'flex: 1; border: none; background: transparent; color: ' + inputTextColor + '; font-size: 1rem; outline: none; resize: none; min-height: 80px;';
      
      var html = '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || content.question || 'Your question') + '</div>';
      html += '<div class="styled-input-container" style="' + containerStyle + '">';
      if (showInputIcon) {
        html += '<span class="input-icon" style="color: ' + inputPlaceholderColor + ';">💬</span>';
      }
      html += '<textarea id="' + questionId + '" style="' + fieldStyle + '" placeholder="' + (content.placeholder || 'Type your answer...') + '" onkeydown="if(event.key===\\'Enter\\' && !event.shiftKey){event.preventDefault();handleTextSubmit(\\'' + questionId + '\\');}"></textarea>';
      html += '</div>';
      html += '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleTextSubmit(\\'' + questionId + '\\')">' + (content.submit_button_text || 'Submit') + '</button>';
      html += '<div class="press-enter-hint">Press Enter ↵</div>';
      
      return html;
    }
    
    function renderMultiChoice(content, index) {
      var design = content.design || {};
      var btnStyle = getButtonStyle(design);
      var options = content.options || [];
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      var html = '<div class="question-counter">Question ' + (index + 1) + ' of ' + STEPS_DATA.length + '</div>';
      html += '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || content.question || 'Choose an option') + '</div>';
      html += renderOptionsHTML(options, index, design);
      html += '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleMultiChoiceSubmit(' + index + ')">' + (content.next_button_text || content.button_text || 'Next Question') + '</button>';
      
      return html;
    }
    
    function renderEmailCapture(content) {
      var design = content.design || {};
      var btnStyle = getButtonStyle(design);
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      return '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || 'Enter your email') + '</div>' +
        (content.subheadline ? '<div class="element-subheadline">' + content.subheadline + '</div>' : '') +
        (content.subtext ? '<div class="element-subheadline">' + content.subtext + '</div>' : '') +
        '<input type="email" class="input-field" id="email-input" placeholder="' + (content.placeholder || 'your@email.com') + '">' +
        '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleEmailSubmit()">Continue</button>';
    }
    
    function renderPhoneCapture(content) {
      var design = content.design || {};
      var btnStyle = getButtonStyle(design);
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      return '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || 'Enter your phone number') + '</div>' +
        (content.subheadline ? '<div class="element-subheadline">' + content.subheadline + '</div>' : '') +
        (content.subtext ? '<div class="element-subheadline">' + content.subtext + '</div>' : '') +
        '<input type="tel" class="input-field" id="phone-input" placeholder="' + (content.placeholder || '+1 (555) 000-0000') + '" oninput="formatPhoneInput(this)">' +
        '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handlePhoneSubmit()">Continue</button>';
    }
    
    function renderOptIn(content) {
      var design = content.design || {};
      var isRequired = content.is_required !== false;
      var settings = FUNNEL_DATA.settings || {};
      var primaryColor = settings.primary_color || '#22c55e';
      
      var inputBg = design.inputBg || '#ffffff';
      var inputTextColor = design.inputTextColor || '#0a0a0a';
      var inputBorder = design.inputBorder || '#e5e7eb';
      var inputBorderWidth = design.inputBorderWidth || 1;
      var inputRadius = design.inputRadius || 12;
      var inputPlaceholderColor = design.inputPlaceholderColor || '#9ca3af';
      var showInputIcon = design.inputShowIcon !== false;
      
      var buttonColor = design.buttonColor || primaryColor;
      var buttonTextColor = design.buttonTextColor || '#ffffff';
      var borderRadius = design.borderRadius || 12;
      
      var buttonStyle = 'color: ' + buttonTextColor + '; border-radius: ' + borderRadius + 'px;';
      if (design.useButtonGradient && design.buttonGradientFrom) {
        var gradientTo = design.buttonGradientTo || design.buttonGradientFrom;
        var direction = design.buttonGradientDirection || '135deg';
        buttonStyle += ' background: linear-gradient(' + direction + ', ' + design.buttonGradientFrom + ', ' + gradientTo + ');';
      } else {
        buttonStyle += ' background: ' + buttonColor + ';';
      }
      
      var hoverClass = design.buttonHoverEffect ? ' hover-' + design.buttonHoverEffect : '';
      
      var nameIcon = content.name_icon || '👋';
      var emailIcon = content.email_icon || '✉️';
      var phoneIcon = content.phone_icon || '🇺🇸';
      
      var inputStyle = 'display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: ' + inputBg + '; border: ' + inputBorderWidth + 'px solid ' + inputBorder + '; border-radius: ' + inputRadius + 'px; margin-bottom: 0.25rem;';
      var fieldStyle = 'flex: 1; border: none; background: transparent; color: ' + inputTextColor + '; font-size: 1rem; outline: none;';
      
      var privacyText = content.privacy_text || 'I have read and accept the';
      var privacyLink = content.privacy_link || '#';
      var privacyHtml = '<div class="privacy-row"><input type="checkbox" class="privacy-checkbox" id="privacy-check"><span class="privacy-text">' + privacyText + ' <a href="' + privacyLink + '" target="_blank">privacy policy</a>.</span></div>';
      
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      return '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || 'Complete your information') + '</div>' +
        '<div id="name-container" style="' + inputStyle + '">' + (showInputIcon ? '<span style="font-size: 1.25rem;">' + nameIcon + '</span>' : '') + '<input type="text" style="' + fieldStyle + '" id="name-input" placeholder="' + (content.name_placeholder || 'Your name') + '" data-required="' + isRequired + '"></div>' +
        '<div id="name-error" class="error-message"></div>' +
        '<div id="email-container" style="' + inputStyle + '">' + (showInputIcon ? '<span style="font-size: 1.25rem;">' + emailIcon + '</span>' : '') + '<input type="email" style="' + fieldStyle + '" id="optin-email" placeholder="' + (content.email_placeholder || 'Your email address') + '" data-required="' + isRequired + '"></div>' +
        '<div id="email-error" class="error-message"></div>' +
        '<div id="phone-container" style="' + inputStyle + '">' + (showInputIcon ? '<span style="font-size: 1.25rem;">' + phoneIcon + '</span>' : '') + '<span style="color: ' + inputPlaceholderColor + '; font-size: 0.875rem; flex-shrink: 0;">+1</span><input type="tel" style="' + fieldStyle + '" id="optin-phone" placeholder="' + (content.phone_placeholder || 'Your phone number') + '" maxlength="14" data-required="' + isRequired + '" oninput="formatPhoneInput(this)"></div>' +
        '<div id="phone-error" class="error-message"></div>' +
        privacyHtml +
        '<button class="element-button' + hoverClass + '" style="' + buttonStyle + '" onclick="handleOptInSubmit(' + isRequired + ')">' + (content.submit_button_text || 'Submit and proceed') + '</button>';
    }
    
    function renderVideo(content) {
      var design = content.design || {};
      var btnStyle = getButtonStyle(design);
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      var videoHTML = renderVideoElement(content.video_url || '');
      
      return '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || 'Watch this video') + '</div>' +
        videoHTML +
        '<button class="element-button' + btnStyle.hoverClass + '" style="' + btnStyle.style + '" onclick="handleNext()">' + (content.button_text || 'Continue') + '</button>';
    }
    
    function renderEmbed(content) {
      var design = content.design || {};
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      var scale = content.scale || 0.75;
      
      return '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || '') + '</div>' +
        '<div class="element-embed" style="transform: scale(' + scale + '); transform-origin: top center;">' +
          '<iframe src="' + (content.embed_url || '') + '" allow="camera; microphone"></iframe>' +
        '</div>';
    }
    
    function renderThankYou(content) {
      var design = content.design || {};
      var fontStyle = design.fontFamily ? 'font-family: ' + design.fontFamily + ';' : '';
      
      var html = '<div class="element-headline" style="' + fontStyle + '">' + (content.headline || 'Thank you!') + '</div>';
      if (content.subheadline) {
        html += '<div class="element-subheadline">' + content.subheadline + '</div>';
      }
      if (content.subtext) {
        html += '<div class="element-subheadline">' + content.subtext + '</div>';
      }
      if (content.redirect_url) {
        setTimeout(function() { window.location.href = content.redirect_url; }, 3000);
      }
      return html;
    }
    
    function handleNext() {
      saveLead();
      goToNextStep();
    }
    
    function handleTextSubmit(inputId) {
      var input = document.getElementById(inputId);
      var value = input ? input.value.trim() : '';
      if (value) answers[inputId] = value;
      handleNext();
    }
    
    function selectOption(element, stepIndex, value) {
      var container = element.parentElement;
      var cards = container.querySelectorAll('.option-card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('selected');
      }
      element.classList.add('selected');
      answers['choice_' + stepIndex] = value;
    }
    
    function handleMultiChoiceSubmit(stepIndex) {
      if (answers['choice_' + stepIndex]) handleNext();
    }
    
    function handleEmailSubmit() {
      var email = document.getElementById('email-input');
      var value = email ? email.value.trim() : '';
      if (value && validateEmail(value)) {
        answers.email = value;
        handleNext();
      } else if (email) {
        email.style.borderColor = '#ef4444';
      }
    }
    
    function handlePhoneSubmit() {
      var phone = document.getElementById('phone-input');
      var value = phone ? phone.value.trim() : '';
      if (value) {
        answers.phone = value;
        handleNext();
      }
    }
    
    function formatPhoneInput(input) {
      var digits = input.value.replace(/\\D/g, '');
      if (digits.length <= 3) {
        input.value = digits;
      } else if (digits.length <= 6) {
        input.value = '(' + digits.slice(0,3) + ') ' + digits.slice(3);
      } else {
        input.value = '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6,10);
      }
    }
    
    function validateEmail(email) {
      return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
    }
    
    function handleOptInSubmit(isRequired) {
      var name = document.getElementById('name-input');
      var email = document.getElementById('optin-email');
      var phone = document.getElementById('optin-phone');
      
      var nameVal = name ? name.value.trim() : '';
      var emailVal = email ? email.value.trim() : '';
      var phoneVal = phone ? phone.value.trim() : '';
      
      // Clear errors
      ['name', 'email', 'phone'].forEach(function(field) {
        var err = document.getElementById(field + '-error');
        var container = document.getElementById(field + '-container');
        if (err) { err.style.display = 'none'; err.textContent = ''; }
        if (container) container.style.borderColor = '';
      });
      
      var hasErrors = false;
      
      if (isRequired) {
        if (!nameVal) {
          document.getElementById('name-error').textContent = 'Name is required';
          document.getElementById('name-error').style.display = 'block';
          document.getElementById('name-container').style.borderColor = '#ef4444';
          hasErrors = true;
        }
        if (!emailVal) {
          document.getElementById('email-error').textContent = 'Email is required';
          document.getElementById('email-error').style.display = 'block';
          document.getElementById('email-container').style.borderColor = '#ef4444';
          hasErrors = true;
        } else if (!validateEmail(emailVal)) {
          document.getElementById('email-error').textContent = 'Invalid email';
          document.getElementById('email-error').style.display = 'block';
          document.getElementById('email-container').style.borderColor = '#ef4444';
          hasErrors = true;
        }
        if (!phoneVal || phoneVal.replace(/\\D/g, '').length < 10) {
          document.getElementById('phone-error').textContent = 'Valid phone required';
          document.getElementById('phone-error').style.display = 'block';
          document.getElementById('phone-container').style.borderColor = '#ef4444';
          hasErrors = true;
        }
      }
      
      if (hasErrors) return;
      
      if (nameVal) answers.name = nameVal;
      if (emailVal) answers.email = emailVal;
      if (phoneVal) answers.phone = phoneVal;
      answers.opt_in = document.getElementById('privacy-check') ? document.getElementById('privacy-check').checked : false;
      handleNext();
    }
    
    function goToNextStep() {
      if (currentStepIndex >= STEPS_DATA.length - 1) return;
      
      var currentStep = document.querySelector('[data-step-index="' + currentStepIndex + '"]');
      if (currentStep) currentStep.classList.add('step-hidden');
      
      currentStepIndex++;
      var nextStep = document.querySelector('[data-step-index="' + currentStepIndex + '"]');
      if (nextStep) {
        nextStep.classList.remove('step-hidden');
        nextStep.classList.add('fade-in');
      }
      
      var dots = document.querySelectorAll('.progress-dot');
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.remove('active');
        if (i < currentStepIndex) dots[i].classList.add('completed');
        if (i === currentStepIndex) dots[i].classList.add('active');
      }
    }
    
    async function saveLead() {
      if (!answers.email && !answers.phone && !answers.name && Object.keys(answers).length === 0) return;
      
      try {
        var response = await fetch(SUPABASE_URL + '/functions/v1/submit-funnel-lead', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            funnel_id: FUNNEL_DATA.id,
            team_id: FUNNEL_DATA.team_id,
            lead_id: leadId,
            email: answers.email || null,
            phone: answers.phone || null,
            name: answers.name || null,
            answers: answers,
            calendly_booking_data: calendlyBookingData,
          }),
        });
        
        var data = await response.json();
        if (data.lead_id) leadId = data.lead_id;
      } catch (err) {
        console.error('Failed to save lead:', err);
      }
    }
  </script>
</body>
</html>`;
}
