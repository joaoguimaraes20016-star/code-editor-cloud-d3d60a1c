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
    // Always try to get domain from URL query params first (for Caddy GET requests)
    const url = new URL(req.url);
    let domain: string | null = url.searchParams.get('domain');
    
    console.log(`Request method: ${req.method}`);
    console.log(`Query param domain: ${domain}`);
    console.log(`X-Forwarded-Host: ${req.headers.get('x-forwarded-host')}`);
    console.log(`Host: ${req.headers.get('host')}`);
    
    // If no domain from query params, try headers
    if (!domain) {
      domain = req.headers.get('x-forwarded-host') || req.headers.get('host');
    }
    
    // Only try JSON body for POST requests, wrapped in try-catch to prevent crashes
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

    return new Response(html, {
      status: 200,
      headers: new Headers({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }),
    });

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

// Safely escape JSON for embedding in script tags
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
    
    /* Dynamic Elements */
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
      margin-bottom: 1rem;
    }
    
    .element-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px ${primaryColor}40;
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
    
    /* Input fields */
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
    
    /* Option cards */
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
    .option-label { color: white; font-size: 1rem; font-weight: 500; flex: 1; }
    
    .option-radio {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
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
    
    .step-hidden { display: none; }
    
    .fade-in {
      animation: fadeIn 0.3s ease forwards;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
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
    
    document.addEventListener('DOMContentLoaded', () => {
      renderFunnel();
      setupCalendlyListener();
    });
    
    function setupCalendlyListener() {
      window.addEventListener('message', (event) => {
        if (event.data.event === 'calendly.event_scheduled') {
          console.log('Calendly booking detected:', event.data);
          calendlyBookingData = {
            event_time: event.data.payload?.event?.start_time,
            event_type: event.data.payload?.event_type?.name,
            invitee_uri: event.data.payload?.invitee?.uri,
            scheduling_url: event.data.payload?.event?.scheduling_url,
          };
          setTimeout(() => handleNext(), 1500);
        }
      });
    }
    
    function renderFunnel() {
      const root = document.getElementById('funnel-root');
      const settings = FUNNEL_DATA.settings || {};
      
      const dotsHTML = STEPS_DATA.map((_, index) => 
        '<div class="progress-dot ' + (index === 0 ? 'active' : '') + '" data-index="' + index + '"></div>'
      ).join('');
      
      const logoHTML = settings.logo_url 
        ? '<div class="logo"><img src="' + settings.logo_url + '" alt="Logo"></div>' 
        : '';
      
      const stepsHTML = STEPS_DATA.map((step, index) => {
        return '<div class="step-container ' + (index !== 0 ? 'step-hidden' : 'fade-in') + '" data-step-index="' + index + '">' +
          '<div class="step-content">' + renderStepContent(step, index) + '</div>' +
        '</div>';
      }).join('');
      
      root.innerHTML = logoHTML + '<div class="progress-dots">' + dotsHTML + '</div>' + stepsHTML;
    }
    
    function renderStepContent(step, index) {
      const content = step.content || {};
      const type = step.step_type;
      
      // Check if step has element_order (dynamic elements)
      if (content.element_order && Array.isArray(content.element_order) && content.element_order.length > 0) {
        return renderDynamicElements(content, index);
      }
      
      // Fallback to basic rendering
      switch (type) {
        case 'welcome': return renderWelcome(content);
        case 'text': return renderTextQuestion(content, index);
        case 'multi_choice': return renderMultiChoice(content, index);
        case 'email': return renderEmailCapture(content);
        case 'phone': return renderPhoneCapture(content);
        case 'opt_in': return renderOptIn(content);
        case 'video': return renderVideo(content);
        case 'embed': return renderEmbed(content);
        case 'thank_you': return renderThankYou(content);
        default: return '<p style="color: white;">Step: ' + type + '</p>';
      }
    }
    
    function renderDynamicElements(content, stepIndex) {
      const elementOrder = content.element_order || [];
      const dynamicElements = content.dynamic_elements || {};
      let html = '';
      
      for (const elementId of elementOrder) {
        // Check if it's a base element (headline, subheadline, button, video)
        if (elementId === 'headline' && content.headline) {
          html += '<div class="element-headline">' + content.headline + '</div>';
        } else if (elementId === 'subheadline' && content.subheadline) {
          html += '<div class="element-subheadline">' + content.subheadline + '</div>';
        } else if (elementId === 'button') {
          html += '<button class="element-button" onclick="handleNext()">' + (content.button_text || 'Continue') + '</button>';
        } else if (elementId === 'video' && content.video_url) {
          html += renderVideoElement(content.video_url);
        } else if (dynamicElements[elementId]) {
          // Render dynamic element
          html += renderDynamicElement(elementId, dynamicElements[elementId]);
        } else if (elementId.startsWith('divider')) {
          // Divider element
          html += '<div class="element-divider"></div>';
        }
      }
      
      return html;
    }
    
    function renderDynamicElement(elementId, element) {
      if (elementId.startsWith('text_')) {
        return '<div class="element-text">' + (element.text || '') + '</div>';
      } else if (elementId.startsWith('headline_copy') || elementId.startsWith('headline_')) {
        return '<div class="element-headline">' + (element.text || '') + '</div>';
      } else if (elementId.startsWith('button_')) {
        return '<button class="element-button" onclick="handleNext()">' + (element.text || 'Continue') + '</button>';
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
      
      let embedUrl = '';
      
      // YouTube
      if (videoUrl.indexOf('youtube.com') !== -1 || videoUrl.indexOf('youtu.be') !== -1) {
        var vidId = '';
        if (videoUrl.indexOf('v=') !== -1) {
          vidId = videoUrl.split('v=')[1];
          var ampPos = vidId.indexOf('&');
          if (ampPos !== -1) vidId = vidId.substring(0, ampPos);
        } else if (videoUrl.indexOf('youtu.be/') !== -1) {
          vidId = videoUrl.split('youtu.be/')[1];
          var qPos = vidId.indexOf('?');
          if (qPos !== -1) vidId = vidId.substring(0, qPos);
        }
        if (vidId) embedUrl = 'https://www.youtube.com/embed/' + vidId;
      }
      // Vimeo
      else if (videoUrl.indexOf('vimeo.com') !== -1) {
        var parts = videoUrl.split('/');
        var vimeoId = parts[parts.length - 1].split('?')[0];
        if (vimeoId) embedUrl = 'https://player.vimeo.com/video/' + vimeoId;
      }
      // Loom
      else if (videoUrl.indexOf('loom.com') !== -1) {
        if (videoUrl.indexOf('/share/') !== -1) {
          var loomId = videoUrl.split('/share/')[1].split('?')[0];
          if (loomId) embedUrl = 'https://www.loom.com/embed/' + loomId;
        } else if (videoUrl.indexOf('/embed/') !== -1) {
          embedUrl = videoUrl;
        }
      }
      // Wistia (handles subdomains like legitstealthy07.wistia.com)
      else if (videoUrl.indexOf('wistia.com') !== -1 || videoUrl.indexOf('wistia.net') !== -1) {
        if (videoUrl.indexOf('/medias/') !== -1) {
          var wistiaId = videoUrl.split('/medias/')[1].split('?')[0].split('/')[0];
          if (wistiaId) embedUrl = 'https://fast.wistia.net/embed/iframe/' + wistiaId;
        } else if (videoUrl.indexOf('/embed/iframe/') !== -1) {
          embedUrl = videoUrl;
        }
      }
      
      // Fallback: if URL already looks like an embed URL, use it directly
      if (!embedUrl && (videoUrl.indexOf('/embed/') !== -1 || videoUrl.indexOf('/embed?') !== -1)) {
        embedUrl = videoUrl;
      }
      
      if (embedUrl) {
        return '<div class="element-video"><iframe src="' + embedUrl + '" allowfullscreen allow="autoplay; fullscreen"></iframe></div>';
      }
      return '';
    }
    
    function renderWelcome(content) {
      return '<div class="element-headline">' + (content.headline || 'Welcome') + '</div>' +
        (content.subheadline ? '<div class="element-subheadline">' + content.subheadline + '</div>' : '') +
        '<button class="element-button" onclick="handleNext()">' + (content.button_text || 'Get Started') + '</button>';
    }
    
    function renderTextQuestion(content, index) {
      const questionId = 'question_' + index;
      return '<div class="question-counter">Question ' + (index + 1) + ' of ' + STEPS_DATA.length + '</div>' +
        '<div class="element-headline">' + (content.question || 'Your question') + '</div>' +
        '<input type="text" class="input-field" id="' + questionId + '" placeholder="' + (content.placeholder || 'Type your answer...') + '">' +
        '<button class="element-button" onclick="handleTextSubmit(\\'' + questionId + '\\')">Continue</button>';
    }
    
    function renderMultiChoice(content, index) {
      const options = content.options || [];
      const optionsHTML = options.map((opt, i) => 
        '<div class="option-card" onclick="selectOption(this, ' + index + ', \\'' + (opt.label || opt).replace(/'/g, "\\\\'") + '\\')">' +
          (opt.icon ? '<span class="option-icon">' + opt.icon + '</span>' : '') +
          '<span class="option-label">' + (opt.label || opt) + '</span>' +
          '<div class="option-radio"><div class="option-radio-inner"></div></div>' +
        '</div>'
      ).join('');
      
      return '<div class="question-counter">Question ' + (index + 1) + ' of ' + STEPS_DATA.length + '</div>' +
        '<div class="element-headline">' + (content.question || 'Choose an option') + '</div>' +
        '<div class="options-container">' + optionsHTML + '</div>' +
        '<button class="element-button" style="margin-top: 1rem;" onclick="handleMultiChoiceSubmit(' + index + ')">Continue</button>';
    }
    
    function renderEmailCapture(content) {
      return '<div class="element-headline">' + (content.headline || 'Enter your email') + '</div>' +
        (content.subheadline ? '<div class="element-subheadline">' + content.subheadline + '</div>' : '') +
        '<input type="email" class="input-field" id="email-input" placeholder="' + (content.placeholder || 'your@email.com') + '">' +
        '<button class="element-button" onclick="handleEmailSubmit()">Continue</button>';
    }
    
    function renderPhoneCapture(content) {
      return '<div class="element-headline">' + (content.headline || 'Enter your phone number') + '</div>' +
        (content.subheadline ? '<div class="element-subheadline">' + content.subheadline + '</div>' : '') +
        '<input type="tel" class="input-field" id="phone-input" placeholder="' + (content.placeholder || '+1 (555) 000-0000') + '">' +
        '<button class="element-button" onclick="handlePhoneSubmit()">Continue</button>';
    }
    
    function renderOptIn(content) {
      return '<div class="element-headline">' + (content.headline || 'Complete your information') + '</div>' +
        '<input type="text" class="input-field" id="name-input" placeholder="' + (content.name_placeholder || 'Your name') + '">' +
        '<input type="email" class="input-field" id="optin-email" placeholder="' + (content.email_placeholder || 'Your email') + '">' +
        '<input type="tel" class="input-field" id="optin-phone" placeholder="' + (content.phone_placeholder || 'Your phone') + '">' +
        '<button class="element-button" onclick="handleOptInSubmit()">Continue</button>';
    }
    
    function renderVideo(content) {
      const videoHTML = renderVideoElement(content.video_url || '');
      return '<div class="element-headline">' + (content.headline || 'Watch this video') + '</div>' +
        videoHTML +
        '<button class="element-button" onclick="handleNext()">' + (content.button_text || 'Continue') + '</button>';
    }
    
    function renderEmbed(content) {
      const scale = content.scale || 0.75;
      return '<div class="element-headline">' + (content.headline || '') + '</div>' +
        '<div class="element-embed" style="transform: scale(' + scale + '); transform-origin: top center;">' +
          '<iframe src="' + (content.embed_url || '') + '" allow="camera; microphone"></iframe>' +
        '</div>';
    }
    
    function renderThankYou(content) {
      let html = '<div class="element-headline">' + (content.headline || 'Thank you!') + '</div>';
      if (content.subheadline) {
        html += '<div class="element-subheadline">' + content.subheadline + '</div>';
      }
      if (content.redirect_url) {
        html += '<script>setTimeout(function() { window.location.href = "' + content.redirect_url + '"; }, 3000);</' + 'script>';
      }
      return html;
    }
    
    function handleNext() {
      saveLead();
      goToNextStep();
    }
    
    function handleTextSubmit(inputId) {
      const input = document.getElementById(inputId);
      const value = input?.value?.trim();
      if (value) answers[inputId] = value;
      handleNext();
    }
    
    function selectOption(element, stepIndex, value) {
      const container = element.parentElement;
      container.querySelectorAll('.option-card').forEach(function(card) { card.classList.remove('selected'); });
      element.classList.add('selected');
      answers['choice_' + stepIndex] = value;
    }
    
    function handleMultiChoiceSubmit(stepIndex) {
      if (answers['choice_' + stepIndex]) handleNext();
    }
    
    function handleEmailSubmit() {
      const email = document.getElementById('email-input')?.value?.trim();
      if (email) { answers.email = email; handleNext(); }
    }
    
    function handlePhoneSubmit() {
      const phone = document.getElementById('phone-input')?.value?.trim();
      if (phone) { answers.phone = phone; handleNext(); }
    }
    
    function handleOptInSubmit() {
      const name = document.getElementById('name-input')?.value?.trim();
      const email = document.getElementById('optin-email')?.value?.trim();
      const phone = document.getElementById('optin-phone')?.value?.trim();
      if (name) answers.name = name;
      if (email) answers.email = email;
      if (phone) answers.phone = phone;
      handleNext();
    }
    
    function goToNextStep() {
      if (currentStepIndex >= STEPS_DATA.length - 1) return;
      
      const currentStep = document.querySelector('[data-step-index="' + currentStepIndex + '"]');
      if (currentStep) currentStep.classList.add('step-hidden');
      
      currentStepIndex++;
      const nextStep = document.querySelector('[data-step-index="' + currentStepIndex + '"]');
      if (nextStep) {
        nextStep.classList.remove('step-hidden');
        nextStep.classList.add('fade-in');
      }
      
      document.querySelectorAll('.progress-dot').forEach(function(dot, index) {
        dot.classList.remove('active');
        if (index < currentStepIndex) dot.classList.add('completed');
        if (index === currentStepIndex) dot.classList.add('active');
      });
    }
    
    async function saveLead() {
      if (!answers.email && !answers.phone && !answers.name && Object.keys(answers).length === 0) return;
      
      try {
        const response = await fetch(SUPABASE_URL + '/functions/v1/submit-funnel-lead', {
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
        
        const data = await response.json();
        if (data.lead_id) leadId = data.lead_id;
      } catch (err) {
        console.error('Failed to save lead:', err);
      }
    }
  </script>
</body>
</html>`;
}
