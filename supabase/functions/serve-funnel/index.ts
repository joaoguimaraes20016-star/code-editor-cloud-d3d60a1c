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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let domain: string | null = null;

    // For GET requests (from Caddy reverse proxy), read domain from query parameter
    if (req.method === 'GET') {
      // Caddy passes the domain as a query parameter: ?domain={host}
      const url = new URL(req.url);
      domain = url.searchParams.get('domain') || 
               req.headers.get('x-forwarded-host') || 
               req.headers.get('host');
      console.log(`GET request - Query domain: ${url.searchParams.get('domain')}, X-Forwarded-Host: ${req.headers.get('x-forwarded-host')}, Host: ${req.headers.get('host')}`);
    } else {
      // For POST requests (legacy), read from body
      const body = await req.json();
      domain = body.domain;
    }
    
    if (!domain) {
      return new Response(
        generateErrorPage('Configuration Error', 'Domain could not be determined from request.'),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    // Clean domain (remove www. if present, remove port if present)
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').split(':')[0];

    console.log(`Serving funnel for domain: ${cleanDomain}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up the domain in funnel_domains
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

    // Find the funnel linked to this domain
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

    // Get funnel steps
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
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      }
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

function generateFunnelHTML(
  funnel: { id: string; slug: string; name: string; team_id: string },
  steps: FunnelStep[],
  settings: FunnelSettings,
  domain: string
): string {
  // Encode data for embedding in the page
  const funnelData = JSON.stringify({
    id: funnel.id,
    slug: funnel.slug,
    name: funnel.name,
    team_id: funnel.team_id,
    settings,
  });
  const stepsData = JSON.stringify(steps);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="${settings.background_color || '#0a0a0a'}">
  <title>${funnel.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      min-height: 100vh;
      background: ${settings.background_color || '#0a0a0a'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }
    
    #funnel-root {
      min-height: 100vh;
      width: 100%;
    }
    
    /* Loading state */
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
    
    /* Step container */
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
    
    /* Logo */
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
    
    /* Progress dots */
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
      background: ${settings.primary_color || '#22c55e'};
      box-shadow: 0 0 8px ${settings.primary_color || '#22c55e'}60;
    }
    
    .progress-dot.completed {
      background: ${settings.primary_color || '#22c55e'};
    }
    
    /* Typography */
    .headline {
      color: white;
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 1rem;
      text-align: center;
    }
    
    @media (min-width: 768px) {
      .headline { font-size: 2.5rem; }
    }
    
    .subheadline {
      color: rgba(255,255,255,0.7);
      font-size: 1rem;
      line-height: 1.5;
      text-align: center;
      margin-bottom: 2rem;
    }
    
    /* Buttons */
    .primary-button {
      width: 100%;
      padding: 1rem 2rem;
      background: ${settings.primary_color || '#22c55e'};
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1.125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .primary-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px ${settings.primary_color || '#22c55e'}40;
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
      border-color: ${settings.primary_color || '#22c55e'};
      box-shadow: 0 0 0 3px ${settings.primary_color || '#22c55e'}20;
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
      border-color: ${settings.primary_color || '#22c55e'};
      background: ${settings.primary_color || '#22c55e'}15;
    }
    
    .option-icon {
      font-size: 1.5rem;
    }
    
    .option-label {
      color: white;
      font-size: 1rem;
      font-weight: 500;
      flex: 1;
    }
    
    .option-radio {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .option-card.selected .option-radio {
      border-color: ${settings.primary_color || '#22c55e'};
    }
    
    .option-radio-inner {
      width: 10px;
      height: 10px;
      background: ${settings.primary_color || '#22c55e'};
      border-radius: 50%;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .option-card.selected .option-radio-inner {
      opacity: 1;
    }
    
    /* Video embed */
    .video-container {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 12px;
      overflow: hidden;
      background: rgba(0,0,0,0.5);
      margin-bottom: 1.5rem;
    }
    
    .video-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    
    /* Embed container */
    .embed-container {
      width: 100%;
      min-height: 500px;
      border-radius: 12px;
      overflow: hidden;
      background: white;
    }
    
    .embed-container iframe {
      width: 100%;
      height: 100%;
      border: none;
      min-height: 500px;
    }
    
    /* Question counter */
    .question-counter {
      color: rgba(255,255,255,0.5);
      font-size: 0.875rem;
      text-align: center;
      margin-bottom: 1.5rem;
    }
    
    /* Hidden steps */
    .step-hidden {
      display: none;
    }
    
    /* Transitions */
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
    // Funnel data embedded from server
    const FUNNEL_DATA = ${funnelData};
    const STEPS_DATA = ${stepsData};
    const SUPABASE_URL = '${Deno.env.get('SUPABASE_URL')}';
    const SUPABASE_ANON_KEY = '${Deno.env.get('SUPABASE_ANON_KEY')}';
    
    // State
    let currentStepIndex = 0;
    let answers = {};
    let leadId = null;
    let calendlyBookingData = null;
    
    // Initialize funnel
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
          // Auto-advance after Calendly booking
          setTimeout(() => handleNext(), 1500);
        }
      });
    }
    
    function renderFunnel() {
      const root = document.getElementById('funnel-root');
      const settings = FUNNEL_DATA.settings;
      
      // Build progress dots
      const dotsHTML = STEPS_DATA.map((_, index) => 
        '<div class="progress-dot ' + (index === 0 ? 'active' : '') + '" data-index="' + index + '"></div>'
      ).join('');
      
      // Build logo HTML
      const logoHTML = settings.logo_url 
        ? '<div class="logo"><img src="' + settings.logo_url + '" alt="Logo"></div>' 
        : '';
      
      // Build steps HTML
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
      
      switch (type) {
        case 'welcome':
          return renderWelcome(content);
        case 'text':
          return renderTextQuestion(content, index);
        case 'multi_choice':
          return renderMultiChoice(content, index);
        case 'email':
          return renderEmailCapture(content);
        case 'phone':
          return renderPhoneCapture(content);
        case 'opt_in':
          return renderOptIn(content);
        case 'video':
          return renderVideo(content);
        case 'embed':
          return renderEmbed(content);
        case 'thank_you':
          return renderThankYou(content);
        default:
          return '<p style="color: white;">Unknown step type: ' + type + '</p>';
      }
    }
    
    function renderWelcome(content) {
      return '<div class="headline">' + (content.headline || 'Welcome') + '</div>' +
        (content.subheadline ? '<div class="subheadline">' + content.subheadline + '</div>' : '') +
        '<button class="primary-button" onclick="handleNext()">' + (content.button_text || 'Get Started') + '</button>';
    }
    
    function renderTextQuestion(content, index) {
      const questionId = 'question_' + index;
      return '<div class="question-counter">Question ' + (index + 1) + ' of ' + STEPS_DATA.length + '</div>' +
        '<div class="headline">' + (content.question || 'Your question') + '</div>' +
        '<input type="text" class="input-field" id="' + questionId + '" placeholder="' + (content.placeholder || 'Type your answer...') + '">' +
        '<button class="primary-button" onclick="handleTextSubmit(\'' + questionId + '\')">Continue</button>';
    }
    
    function renderMultiChoice(content, index) {
      const options = content.options || [];
      const optionsHTML = options.map((opt, i) => 
        '<div class="option-card" onclick="selectOption(this, ' + index + ', \'' + (opt.label || opt) + '\')">' +
          (opt.icon ? '<span class="option-icon">' + opt.icon + '</span>' : '') +
          '<span class="option-label">' + (opt.label || opt) + '</span>' +
          '<div class="option-radio"><div class="option-radio-inner"></div></div>' +
        '</div>'
      ).join('');
      
      return '<div class="question-counter">Question ' + (index + 1) + ' of ' + STEPS_DATA.length + '</div>' +
        '<div class="headline">' + (content.question || 'Choose an option') + '</div>' +
        '<div class="options-container">' + optionsHTML + '</div>' +
        '<button class="primary-button" style="margin-top: 1rem;" onclick="handleMultiChoiceSubmit(' + index + ')">Continue</button>';
    }
    
    function renderEmailCapture(content) {
      return '<div class="headline">' + (content.headline || 'Enter your email') + '</div>' +
        (content.subheadline ? '<div class="subheadline">' + content.subheadline + '</div>' : '') +
        '<input type="email" class="input-field" id="email-input" placeholder="' + (content.placeholder || 'your@email.com') + '">' +
        '<button class="primary-button" onclick="handleEmailSubmit()">Continue</button>';
    }
    
    function renderPhoneCapture(content) {
      return '<div class="headline">' + (content.headline || 'Enter your phone number') + '</div>' +
        (content.subheadline ? '<div class="subheadline">' + content.subheadline + '</div>' : '') +
        '<input type="tel" class="input-field" id="phone-input" placeholder="' + (content.placeholder || '+1 (555) 000-0000') + '">' +
        '<button class="primary-button" onclick="handlePhoneSubmit()">Continue</button>';
    }
    
    function renderOptIn(content) {
      return '<div class="headline">' + (content.headline || 'Complete your information') + '</div>' +
        '<input type="text" class="input-field" id="name-input" placeholder="' + (content.name_placeholder || 'Your name') + '">' +
        '<input type="email" class="input-field" id="optin-email" placeholder="' + (content.email_placeholder || 'Your email') + '">' +
        '<input type="tel" class="input-field" id="optin-phone" placeholder="' + (content.phone_placeholder || 'Your phone') + '">' +
        '<button class="primary-button" onclick="handleOptInSubmit()">Continue</button>';
    }
    
    function renderVideo(content) {
      const videoUrl = content.video_url || '';
      let embedUrl = '';
      
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        const videoId = videoUrl.match(/(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^"&?\\/\\s]{11})/)?.[1];
        if (videoId) embedUrl = 'https://www.youtube.com/embed/' + videoId;
      } else if (videoUrl.includes('vimeo.com')) {
        const vimeoId = videoUrl.match(/vimeo\\.com\\/(?:video\\/)?(\\d+)/)?.[1];
        if (vimeoId) embedUrl = 'https://player.vimeo.com/video/' + vimeoId;
      } else if (videoUrl.includes('loom.com')) {
        const loomId = videoUrl.match(/loom\\.com\\/(?:share|embed)\\/([a-zA-Z0-9]+)/)?.[1];
        if (loomId) embedUrl = 'https://www.loom.com/embed/' + loomId;
      }
      
      return '<div class="headline">' + (content.headline || 'Watch this video') + '</div>' +
        (embedUrl ? '<div class="video-container"><iframe src="' + embedUrl + '" allowfullscreen></iframe></div>' : '<div class="video-container"></div>') +
        '<button class="primary-button" onclick="handleNext()">' + (content.button_text || 'Continue') + '</button>';
    }
    
    function renderEmbed(content) {
      const embedUrl = content.embed_url || '';
      const scale = content.scale || 0.75;
      
      return '<div class="headline">' + (content.headline || '') + '</div>' +
        '<div class="embed-container" style="transform: scale(' + scale + '); transform-origin: top center;">' +
          '<iframe src="' + embedUrl + '" allow="camera; microphone"></iframe>' +
        '</div>';
    }
    
    function renderThankYou(content) {
      return '<div class="headline">' + (content.headline || 'Thank you!') + '</div>' +
        (content.subheadline ? '<div class="subheadline">' + content.subheadline + '</div>' : '') +
        (content.redirect_url ? '<script>setTimeout(() => window.location.href = "' + content.redirect_url + '", 3000);</' + 'script>' : '');
    }
    
    function handleNext() {
      saveLead();
      goToNextStep();
    }
    
    function handleTextSubmit(inputId) {
      const input = document.getElementById(inputId);
      const value = input?.value?.trim();
      if (value) {
        answers[inputId] = value;
      }
      handleNext();
    }
    
    function selectOption(element, stepIndex, value) {
      // Remove selected from siblings
      const container = element.parentElement;
      container.querySelectorAll('.option-card').forEach(card => card.classList.remove('selected'));
      element.classList.add('selected');
      answers['choice_' + stepIndex] = value;
    }
    
    function handleMultiChoiceSubmit(stepIndex) {
      if (answers['choice_' + stepIndex]) {
        handleNext();
      }
    }
    
    function handleEmailSubmit() {
      const email = document.getElementById('email-input')?.value?.trim();
      if (email) {
        answers.email = email;
        handleNext();
      }
    }
    
    function handlePhoneSubmit() {
      const phone = document.getElementById('phone-input')?.value?.trim();
      if (phone) {
        answers.phone = phone;
        handleNext();
      }
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
      
      // Hide current step
      const currentStep = document.querySelector('[data-step-index="' + currentStepIndex + '"]');
      if (currentStep) currentStep.classList.add('step-hidden');
      
      // Show next step
      currentStepIndex++;
      const nextStep = document.querySelector('[data-step-index="' + currentStepIndex + '"]');
      if (nextStep) {
        nextStep.classList.remove('step-hidden');
        nextStep.classList.add('fade-in');
      }
      
      // Update progress dots
      document.querySelectorAll('.progress-dot').forEach((dot, index) => {
        dot.classList.remove('active');
        if (index < currentStepIndex) dot.classList.add('completed');
        if (index === currentStepIndex) dot.classList.add('active');
      });
    }
    
    async function saveLead() {
      // Only save if we have meaningful data
      if (!answers.email && !answers.phone && !answers.name && Object.keys(answers).length === 0) {
        return;
      }
      
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
        if (data.lead_id) {
          leadId = data.lead_id;
        }
      } catch (err) {
        console.error('Failed to save lead:', err);
      }
    }
  </script>
</body>
</html>`;
}
