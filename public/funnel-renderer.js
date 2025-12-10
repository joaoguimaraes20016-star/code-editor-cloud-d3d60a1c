/**
 * Funnel Client-Side Renderer
 * This file is loaded by the VPS and handles all funnel rendering client-side.
 * Updates to this file automatically deploy - no VPS changes needed.
 * 
 * IMPORTANT: This file must stay in sync with serve-funnel edge function for styling parity.
 */

(function() {
  const SUPABASE_URL = 'https://inbvluddkutyfhsxfqco.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluYnZsdWRka3V0eWZoc3hmcWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDc4MjQsImV4cCI6MjA3NjEyMzgyNH0.W0jGEgCTzcErhLHmlSXXknml0AwQH1nVgrWTukXXPYk';

  // State
  let currentStep = 0;
  let steps = [];
  let funnel = null;
  let answers = {};
  let leadId = null;
  let calendlyBookingData = null;

  // Initialize
  async function init() {
    const domain = window.location.hostname.replace(/^www\./, '');
    
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get-funnel-data?domain=${encodeURIComponent(domain)}`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        showError(error.error || 'Failed to load funnel');
        return;
      }

      const data = await response.json();
      funnel = data.funnel;
      steps = data.steps || [];

      if (steps.length === 0) {
        showError('No steps configured for this funnel');
        return;
      }

      render();
      setupCalendlyListener();
    } catch (err) {
      console.error('Funnel load error:', err);
      showError('Failed to connect to server');
    }
  }

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
        saveLead();
        setTimeout(() => nextStep(), 1500);
      }
    });
  }

  function showError(message) {
    document.getElementById('funnel-app').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;font-family:system-ui,sans-serif;">
        <div style="text-align:center;padding:2rem;">
          <h1 style="font-size:1.5rem;margin-bottom:1rem;">Unable to load</h1>
          <p style="color:#888;">${escapeHtml(message)}</p>
        </div>
      </div>
    `;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Get button style from design config - matching serve-funnel exactly
  function getButtonStyle(design, settings) {
    const primaryColor = settings?.primary_color || '#22c55e';
    let style = '';
    let hoverClass = '';
    
    if (design?.useButtonGradient && design?.buttonGradientFrom && design?.buttonGradientTo) {
      const direction = design.buttonGradientDirection || '135deg';
      style = `background: linear-gradient(${direction}, ${design.buttonGradientFrom}, ${design.buttonGradientTo});`;
    } else if (design?.buttonColor) {
      style = `background: ${design.buttonColor};`;
    } else {
      style = `background: ${primaryColor};`;
    }
    
    if (design?.buttonTextColor) {
      style += ` color: ${design.buttonTextColor};`;
    } else {
      style += ' color: #fff;';
    }
    
    if (design?.borderRadius) {
      style += ` border-radius: ${design.borderRadius}px;`;
    } else {
      style += ' border-radius: 12px;';
    }
    
    if (design?.fontFamily) {
      style += ` font-family: ${design.fontFamily};`;
    }
    
    if (design?.buttonHoverEffect) {
      hoverClass = ` hover-${design.buttonHoverEffect}`;
    }
    
    return { style, hoverClass };
  }

  function render() {
    const settings = funnel.settings || {};
    const bgColor = settings.background_color || '#000000';
    const primaryColor = settings.primary_color || '#22c55e';

    const step = steps[currentStep];
    const content = step?.content || {};

    document.getElementById('funnel-app').innerHTML = `
      <style>
        .element-button {
          display: block;
          width: 100%;
          max-width: 400px;
          margin: 0 auto 1rem;
          padding: 1rem 2rem;
          border: none;
          font-size: 1.125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }
        .element-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }
        .element-button.hover-glow:hover {
          box-shadow: 0 0 30px ${primaryColor}80;
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
        .option-card.selected .option-radio {
          border-color: ${primaryColor};
        }
        .option-radio-inner {
          width: 10px;
          height: 10px;
          background: ${primaryColor};
          border-radius: 50%;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .option-card.selected .option-radio-inner {
          opacity: 1;
        }
        .styled-input-container:focus-within {
          border-color: ${primaryColor};
          box-shadow: 0 0 0 3px ${primaryColor}20;
        }
        .error-message {
          color: #f87171;
          font-size: 0.75rem;
          margin-top: -0.25rem;
          margin-bottom: 0.5rem;
          display: none;
        }
        .privacy-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin: 1rem 0;
          color: rgba(255,255,255,0.7);
          font-size: 0.875rem;
        }
        .privacy-checkbox {
          accent-color: ${primaryColor};
          flex-shrink: 0;
          margin-top: 2px;
        }
        .privacy-text a {
          color: ${primaryColor};
          text-decoration: underline;
        }
      </style>
      <div class="funnel-container" style="min-height:100vh;background:${bgColor};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;font-family:system-ui,-apple-system,sans-serif;">
        ${settings.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="Logo" style="max-height:40px;margin-bottom:2rem;">` : ''}
        
        <div class="step-content" style="width:100%;max-width:500px;text-align:center;">
          ${renderStep(step, settings)}
        </div>
        
        ${steps.length > 1 ? renderProgressDots() : ''}
      </div>
    `;

    attachEventListeners(step, settings);
  }

  function renderStep(step, settings) {
    const content = step?.content || {};
    const stepType = step?.step_type || 'welcome';

    // Check for dynamic elements first
    if (content.element_order && content.dynamic_elements) {
      return renderDynamicElements(content, settings, stepType);
    }

    // Fallback to step type rendering
    switch (stepType) {
      case 'welcome':
        return renderWelcome(content, settings);
      case 'text_question':
        return renderTextQuestion(content, settings);
      case 'multi_choice':
        return renderMultiChoice(content, settings);
      case 'email_capture':
        return renderEmailCapture(content, settings);
      case 'phone_capture':
        return renderPhoneCapture(content, settings);
      case 'video':
        return renderVideo(content, settings);
      case 'embed':
        return renderEmbed(content, settings);
      case 'opt_in':
        return renderOptIn(content, settings);
      case 'thank_you':
        return renderThankYou(content, settings);
      default:
        return renderWelcome(content, settings);
    }
  }

  function renderDynamicElements(content, settings, stepType) {
    const elements = content.dynamic_elements || {};
    const order = content.element_order || [];
    const design = content.design || {};
    const btnStyle = getButtonStyle(design, settings);
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return order.map(id => {
      const el = elements[id];
      
      // Handle base elements
      if (id === 'headline' && content.headline) {
        return `<h1 style="font-size:2rem;font-weight:bold;color:#fff;margin-bottom:1rem;line-height:1.2;${fontStyle}">${content.headline}</h1>`;
      }
      if (id === 'subheadline' && content.subheadline) {
        return `<p style="font-size:1rem;color:rgba(255,255,255,0.7);margin-bottom:1.5rem;">${content.subheadline}</p>`;
      }
      if (id === 'subtext' && content.subtext) {
        return `<p style="font-size:1rem;color:rgba(255,255,255,0.7);margin-bottom:1.5rem;">${content.subtext}</p>`;
      }
      if (id === 'button') {
        return `<button class="element-button${btnStyle.hoverClass}" data-action="next" style="${btnStyle.style}">${content.button_text || settings.button_text || 'Continue'}</button>`;
      }
      if (id === 'video' && content.video_url) {
        return renderVideoEmbed(content.video_url);
      }
      if (id === 'input') {
        return renderInputElement(stepType, content, design, settings);
      }
      if (id === 'options' && content.options) {
        return renderOptionsHtml(content.options, design, settings);
      }
      
      if (!el) return '';

      // Handle dynamic elements
      if (el.type === 'headline' || id.startsWith('headline_')) {
        return `<h1 style="font-size:${el.fontSize || '2rem'};font-weight:bold;color:${el.color || '#fff'};margin-bottom:1rem;line-height:1.2;${fontStyle}">${el.text || ''}</h1>`;
      }
      if (el.type === 'text' || id.startsWith('text_')) {
        return `<p style="font-size:${el.fontSize || '1rem'};color:${el.color || 'rgba(255,255,255,0.9)'};margin-bottom:1rem;line-height:1.6;${fontStyle}">${el.text || ''}</p>`;
      }
      if (el.type === 'button' || id.startsWith('button_')) {
        let elStyle = btnStyle.style;
        if (el.gradient_from && el.gradient_to) {
          elStyle = `background: linear-gradient(135deg, ${el.gradient_from}, ${el.gradient_to}); color: ${el.textColor || '#fff'}; border-radius: ${design.borderRadius || 12}px;`;
        }
        return `<button class="element-button${btnStyle.hoverClass}" data-action="next" style="${elStyle}">${el.text || 'Continue'}</button>`;
      }
      if (el.type === 'image' || id.startsWith('image_')) {
        return el.src || el.image_url ? `<img src="${escapeHtml(el.src || el.image_url)}" alt="" style="max-width:100%;border-radius:${el.borderRadius || '12px'};margin:1rem 0;">` : '';
      }
      if (el.type === 'video' || id.startsWith('video_')) {
        return renderVideoEmbed(el.url || el.video_url);
      }
      if (el.type === 'embed' || id.startsWith('embed_')) {
        const scale = el.scale || el.embed_scale || 0.75;
        return el.url || el.embed_url ? `<div style="width:100%;margin:1rem 0;"><iframe src="${escapeHtml(el.url || el.embed_url)}" style="width:100%;height:${el.height || '500px'};border:none;border-radius:12px;transform:scale(${scale});transform-origin:top center;" allow="camera; microphone"></iframe></div>` : '';
      }
      if (el.type === 'divider' || id.startsWith('divider')) {
        return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:1.5rem 0;">`;
      }
      
      return '';
    }).join('');
  }

  function renderInputElement(stepType, content, design, settings) {
    const inputBg = design?.inputBg || '#ffffff';
    const inputTextColor = design?.inputTextColor || '#0a0a0a';
    const inputBorder = design?.inputBorder || '#e5e7eb';
    const inputBorderWidth = design?.inputBorderWidth || 1;
    const inputRadius = design?.inputRadius || 12;
    const inputPlaceholderColor = design?.inputPlaceholderColor || '#9ca3af';
    const showInputIcon = design?.inputShowIcon !== false;
    
    const containerStyle = `display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:${inputBg};border:${inputBorderWidth}px solid ${inputBorder};border-radius:${inputRadius}px;margin-bottom:1rem;transition:all 0.2s;`;
    const fieldStyle = `flex:1;border:none;background:transparent;color:${inputTextColor};font-size:1rem;outline:none;resize:none;min-height:80px;`;
    
    const btnStyle = getButtonStyle(design, settings);
    
    return `
      <div class="styled-input-container" style="${containerStyle}">
        ${showInputIcon ? `<span style="color:${inputPlaceholderColor};font-size:1.25rem;flex-shrink:0;">💬</span>` : ''}
        <textarea id="funnel-input" placeholder="${escapeHtml(content.placeholder || 'Type your answer...')}" style="${fieldStyle}"></textarea>
      </div>
      <button class="element-button${btnStyle.hoverClass}" data-action="submit-text" style="${btnStyle.style}">${content.submit_button_text || content.button_text || settings.button_text || 'Submit'}</button>
      <p style="color:rgba(255,255,255,0.4);font-size:0.875rem;margin-top:0.5rem;">Press Enter ↵</p>
    `;
  }

  function renderOptionsHtml(options, design, settings) {
    const btnStyle = getButtonStyle(design, settings);
    
    let html = '<div class="options-container" style="margin-bottom:1rem;">';
    options.forEach((opt, i) => {
      const label = typeof opt === 'string' ? opt : (opt.label || opt.text || '');
      const emoji = typeof opt === 'object' ? (opt.emoji || opt.icon || '') : '';
      
      html += `
        <div class="option-btn option-card" data-value="${escapeHtml(label)}">
          ${emoji ? `<span style="font-size:1.5rem;">${emoji}</span>` : ''}
          <span style="flex:1;color:#fff;font-size:1rem;font-weight:500;text-align:left;">${escapeHtml(label)}</span>
          <div class="option-radio"><div class="option-radio-inner"></div></div>
        </div>
      `;
    });
    html += '</div>';
    html += `<button class="element-button${btnStyle.hoverClass}" data-action="submit-choice" disabled style="${btnStyle.style}opacity:0.5;cursor:not-allowed;">Next Question</button>`;
    return html;
  }

  function renderWelcome(content, settings) {
    const design = content.design || {};
    const btnStyle = getButtonStyle(design, settings);
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return `
      <h1 style="font-size:2rem;font-weight:bold;color:#fff;margin-bottom:1rem;${fontStyle}">${content.headline || 'Welcome'}</h1>
      ${content.subtext ? `<p style="color:rgba(255,255,255,0.7);margin-bottom:2rem;font-size:1.1rem;">${content.subtext}</p>` : ''}
      ${content.subheadline ? `<p style="color:rgba(255,255,255,0.7);margin-bottom:2rem;font-size:1.1rem;">${content.subheadline}</p>` : ''}
      <button class="element-button${btnStyle.hoverClass}" data-action="next" style="${btnStyle.style}">${content.button_text || settings.button_text || 'Get Started'}</button>
    `;
  }

  function renderTextQuestion(content, settings) {
    const design = content.design || {};
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;${fontStyle}">${content.headline || 'Your answer'}</h2>
      ${content.subtext ? `<p style="color:rgba(255,255,255,0.7);margin-bottom:1.5rem;">${content.subtext}</p>` : ''}
      ${renderInputElement('text_question', content, design, settings)}
    `;
  }

  function renderMultiChoice(content, settings) {
    const design = content.design || {};
    const options = content.options || [];
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return `
      <p style="color:rgba(255,255,255,0.5);margin-bottom:0.5rem;font-size:0.9rem;">Question ${currentStep + 1} of ${steps.length}</p>
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1.5rem;${fontStyle}">${content.headline || 'Choose an option'}</h2>
      ${renderOptionsHtml(options, design, settings)}
    `;
  }

  function renderEmailCapture(content, settings) {
    const design = content.design || {};
    const btnStyle = getButtonStyle(design, settings);
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;${fontStyle}">${content.headline || 'Enter your email'}</h2>
      ${content.subtext ? `<p style="color:rgba(255,255,255,0.7);margin-bottom:1.5rem;">${content.subtext}</p>` : ''}
      <input type="email" id="funnel-input" placeholder="${escapeHtml(content.placeholder || 'your@email.com')}" 
        style="width:100%;padding:1rem;border:1px solid rgba(255,255,255,0.2);border-radius:12px;background:rgba(255,255,255,0.1);color:#fff;font-size:1rem;margin-bottom:1rem;outline:none;">
      <button class="element-button${btnStyle.hoverClass}" data-action="submit-email" style="${btnStyle.style}">${settings.button_text || 'Continue'}</button>
    `;
  }

  function renderPhoneCapture(content, settings) {
    const design = content.design || {};
    const btnStyle = getButtonStyle(design, settings);
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;${fontStyle}">${content.headline || 'Enter your phone'}</h2>
      ${content.subtext ? `<p style="color:rgba(255,255,255,0.7);margin-bottom:1.5rem;">${content.subtext}</p>` : ''}
      <input type="tel" id="funnel-input" placeholder="${escapeHtml(content.placeholder || '(555) 555-5555')}" 
        style="width:100%;padding:1rem;border:1px solid rgba(255,255,255,0.2);border-radius:12px;background:rgba(255,255,255,0.1);color:#fff;font-size:1rem;margin-bottom:1rem;outline:none;">
      <button class="element-button${btnStyle.hoverClass}" data-action="submit-phone" style="${btnStyle.style}">${settings.button_text || 'Continue'}</button>
    `;
  }

  function renderVideo(content, settings) {
    const design = content.design || {};
    const btnStyle = getButtonStyle(design, settings);
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;${fontStyle}">${content.headline || ''}</h2>
      ${renderVideoEmbed(content.video_url)}
      <button class="element-button${btnStyle.hoverClass}" data-action="next" style="${btnStyle.style}margin-top:1.5rem;">${content.button_text || settings.button_text || 'Continue'}</button>
    `;
  }

  function renderVideoEmbed(url) {
    if (!url) return '';
    const embedUrl = getEmbedUrl(url);
    return `<div style="width:100%;aspect-ratio:16/9;margin:1rem 0;border-radius:12px;overflow:hidden;"><iframe src="${escapeHtml(embedUrl)}" style="width:100%;height:100%;border:none;" allowfullscreen allow="autoplay; fullscreen"></iframe></div>`;
  }

  function getEmbedUrl(url) {
    if (!url) return '';
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    
    // Vimeo
    if (url.includes('vimeo.com')) {
      const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    // Wistia
    if (url.includes('wistia.com') || url.includes('wistia.net')) {
      if (url.includes('/medias/')) {
        const wistiaId = url.split('/medias/')[1].split('?')[0].split('/')[0];
        if (wistiaId) return `https://fast.wistia.net/embed/iframe/${wistiaId}`;
      } else if (url.includes('/embed/iframe/')) {
        return url;
      }
    }
    
    // Loom
    if (url.includes('loom.com')) {
      if (url.includes('/share/')) {
        const loomId = url.split('/share/')[1].split('?')[0];
        if (loomId) return `https://www.loom.com/embed/${loomId}`;
      } else if (url.includes('/embed/')) {
        return url;
      }
    }
    
    // Fallback for already-embed URLs
    if (url.includes('/embed/') || url.includes('/embed?')) {
      return url;
    }
    
    return url;
  }

  function renderEmbed(content, settings) {
    const design = content.design || {};
    const btnStyle = getButtonStyle(design, settings);
    const embedUrl = content.embed_url || '';
    const isCalendly = embedUrl.includes('calendly.com');
    const scale = content.scale || 0.75;
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    return `
      ${content.headline ? `<h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;${fontStyle}">${content.headline}</h2>` : ''}
      ${content.subtext ? `<p style="color:rgba(255,255,255,0.7);margin-bottom:1rem;">${content.subtext}</p>` : ''}
      <div style="width:100%;margin:1rem 0;">
        <iframe id="embed-frame" src="${escapeHtml(embedUrl)}" style="width:100%;height:650px;border:none;border-radius:12px;transform:scale(${scale});transform-origin:top center;" allow="camera; microphone"></iframe>
      </div>
      ${!isCalendly ? `<button class="element-button${btnStyle.hoverClass}" data-action="next" style="${btnStyle.style}">${settings.button_text || 'Continue'}</button>` : ''}
    `;
  }

  function renderOptIn(content, settings) {
    const design = content.design || {};
    const primaryColor = settings.primary_color || '#22c55e';
    const isRequired = content.is_required !== false;
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    const inputBg = design.inputBg || '#ffffff';
    const inputTextColor = design.inputTextColor || '#0a0a0a';
    const inputBorder = design.inputBorder || '#e5e7eb';
    const inputBorderWidth = design.inputBorderWidth || 1;
    const inputRadius = design.inputRadius || 12;
    const inputPlaceholderColor = design.inputPlaceholderColor || '#9ca3af';
    const showInputIcon = design.inputShowIcon !== false;
    
    const buttonTextColor = design.buttonTextColor || '#ffffff';
    const borderRadius = design.borderRadius || 12;
    
    let buttonStyle = `color: ${buttonTextColor}; border-radius: ${borderRadius}px;`;
    if (design.useButtonGradient && design.buttonGradientFrom) {
      const gradientTo = design.buttonGradientTo || design.buttonGradientFrom;
      const direction = design.buttonGradientDirection || '135deg';
      buttonStyle += ` background: linear-gradient(${direction}, ${design.buttonGradientFrom}, ${gradientTo});`;
    } else {
      buttonStyle += ` background: ${design.buttonColor || primaryColor};`;
    }
    
    const hoverClass = design.buttonHoverEffect ? ` hover-${design.buttonHoverEffect}` : '';
    
    const nameIcon = content.name_icon || '👋';
    const emailIcon = content.email_icon || '✉️';
    const phoneIcon = content.phone_icon || '🇺🇸';
    
    const inputContainerStyle = `display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:${inputBg};border:${inputBorderWidth}px solid ${inputBorder};border-radius:${inputRadius}px;margin-bottom:0.25rem;transition:all 0.2s;`;
    const inputFieldStyle = `flex:1;border:none;background:transparent;color:${inputTextColor};font-size:1rem;outline:none;`;
    
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1.5rem;${fontStyle}">${content.headline || 'Get Started'}</h2>
      <div style="display:flex;flex-direction:column;gap:0.25rem;margin-bottom:1rem;">
        <div id="name-container" class="styled-input-container" style="${inputContainerStyle}">
          ${showInputIcon ? `<span style="font-size:1.25rem;flex-shrink:0;">${nameIcon}</span>` : ''}
          <input type="text" id="funnel-name" placeholder="${escapeHtml(content.name_placeholder || 'Your name')}" 
            style="${inputFieldStyle}" data-required="${isRequired}">
        </div>
        <div id="name-error" class="error-message"></div>
        
        <div id="email-container" class="styled-input-container" style="${inputContainerStyle}">
          ${showInputIcon ? `<span style="font-size:1.25rem;flex-shrink:0;">${emailIcon}</span>` : ''}
          <input type="email" id="funnel-email" placeholder="${escapeHtml(content.email_placeholder || 'Your email address')}" 
            style="${inputFieldStyle}" data-required="${isRequired}">
        </div>
        <div id="email-error" class="error-message"></div>
        
        <div id="phone-container" class="styled-input-container" style="${inputContainerStyle}">
          ${showInputIcon ? `<span style="font-size:1.25rem;flex-shrink:0;">${phoneIcon}</span>` : ''}
          <span style="color:${inputPlaceholderColor};font-size:0.875rem;flex-shrink:0;">+1</span>
          <input type="tel" id="funnel-phone" placeholder="${escapeHtml(content.phone_placeholder || 'Your phone number')}" 
            style="${inputFieldStyle}" data-required="${isRequired}" maxlength="14">
        </div>
        <div id="phone-error" class="error-message"></div>
      </div>
      <label class="privacy-row" style="cursor:pointer;">
        <input type="checkbox" id="funnel-consent" class="privacy-checkbox">
        <span class="privacy-text">${content.privacy_text || 'I have read and accept the'} ${content.privacy_link ? `<a href="${escapeHtml(content.privacy_link)}" target="_blank">privacy policy</a>` : '<span style="text-decoration:underline;">privacy policy</span>'}.</span>
      </label>
      <button class="element-button${hoverClass}" data-action="submit-optin" data-required="${isRequired}" style="${buttonStyle}padding:1rem 2rem;border:none;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${content.submit_button_text || content.button_text || settings.button_text || 'Submit'}</button>
    `;
  }

  function renderThankYou(content, settings) {
    const design = content.design || {};
    const primaryColor = settings.primary_color || '#22c55e';
    const fontStyle = design.fontFamily ? `font-family: ${design.fontFamily};` : '';
    
    if (content.redirect_url) {
      setTimeout(() => {
        window.location.href = content.redirect_url;
      }, 3000);
    }
    
    return `
      <div style="color:${primaryColor};font-size:4rem;margin-bottom:1.5rem;">✓</div>
      <h1 style="font-size:2rem;font-weight:bold;color:#fff;margin-bottom:1rem;${fontStyle}">${content.headline || 'Thank You!'}</h1>
      ${content.subtext ? `<p style="color:rgba(255,255,255,0.7);font-size:1.1rem;">${content.subtext}</p>` : ''}
      ${content.subheadline ? `<p style="color:rgba(255,255,255,0.7);font-size:1.1rem;">${content.subheadline}</p>` : ''}
      ${content.redirect_url ? `<p style="color:rgba(255,255,255,0.4);margin-top:2rem;font-size:0.9rem;">Redirecting in 3 seconds...</p>` : ''}
    `;
  }

  function renderProgressDots() {
    const primaryColor = funnel.settings?.primary_color || '#22c55e';
    return `
      <div style="display:flex;gap:0.5rem;margin-top:2rem;">
        ${steps.map((_, i) => `
          <div style="width:8px;height:8px;border-radius:50%;background:${i === currentStep ? primaryColor : i < currentStep ? primaryColor : 'rgba(255,255,255,0.2)'};transition:background 0.3s;${i === currentStep ? `box-shadow:0 0 8px ${primaryColor}60;` : ''}"></div>
        `).join('')}
      </div>
    `;
  }

  function attachEventListeners(step, settings) {
    const primaryColor = settings.primary_color || '#22c55e';
    
    // Next buttons
    document.querySelectorAll('[data-action="next"]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveLead();
        nextStep();
      });
    });

    // Text submission
    document.querySelectorAll('[data-action="submit-text"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('funnel-input');
        if (input && input.value.trim()) {
          saveAnswer(step.id, input.value.trim());
          saveLead();
          nextStep();
        }
      });
    });

    // Email submission
    document.querySelectorAll('[data-action="submit-email"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('funnel-input');
        if (input && isValidEmail(input.value)) {
          answers.email = input.value.trim();
          saveAnswer(step.id, input.value.trim());
          saveLead();
          nextStep();
        } else if (input) {
          input.style.borderColor = '#ef4444';
        }
      });
    });

    // Phone submission
    document.querySelectorAll('[data-action="submit-phone"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('funnel-input');
        if (input && input.value.trim()) {
          answers.phone = input.value.trim();
          saveAnswer(step.id, input.value.trim());
          saveLead();
          nextStep();
        }
      });
    });

    // Multi-choice options
    let selectedOption = null;
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.option-btn').forEach(b => {
          b.classList.remove('selected');
        });
        btn.classList.add('selected');
        selectedOption = btn.dataset.value;
        
        const submitBtn = document.querySelector('[data-action="submit-choice"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        }
      });
    });

    document.querySelectorAll('[data-action="submit-choice"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (selectedOption) {
          saveAnswer(step.id, selectedOption);
          saveLead();
          nextStep();
        }
      });
    });

    // Opt-in submission with validation
    document.querySelectorAll('[data-action="submit-optin"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const isRequired = btn.dataset.required === 'true';
        const name = document.getElementById('funnel-name')?.value?.trim() || '';
        const email = document.getElementById('funnel-email')?.value?.trim() || '';
        const phone = document.getElementById('funnel-phone')?.value?.trim() || '';
        const consent = document.getElementById('funnel-consent')?.checked;

        // Clear previous errors
        ['name', 'email', 'phone'].forEach(field => {
          const errorEl = document.getElementById(`${field}-error`);
          const containerEl = document.getElementById(`${field}-container`);
          if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
          if (containerEl) containerEl.style.borderColor = '';
        });

        let hasErrors = false;

        if (isRequired) {
          if (!name) {
            document.getElementById('name-error').textContent = 'Name is required';
            document.getElementById('name-error').style.display = 'block';
            document.getElementById('name-container').style.borderColor = '#ef4444';
            hasErrors = true;
          }
          if (!email) {
            document.getElementById('email-error').textContent = 'Email is required';
            document.getElementById('email-error').style.display = 'block';
            document.getElementById('email-container').style.borderColor = '#ef4444';
            hasErrors = true;
          } else if (!isValidEmail(email)) {
            document.getElementById('email-error').textContent = 'Invalid email';
            document.getElementById('email-error').style.display = 'block';
            document.getElementById('email-container').style.borderColor = '#ef4444';
            hasErrors = true;
          }
          if (!phone || phone.replace(/\D/g, '').length < 10) {
            document.getElementById('phone-error').textContent = 'Valid phone required';
            document.getElementById('phone-error').style.display = 'block';
            document.getElementById('phone-container').style.borderColor = '#ef4444';
            hasErrors = true;
          }
        }

        if (hasErrors) return;

        answers.name = name;
        answers.email = email;
        answers.phone = phone;
        answers.opt_in = consent;
        saveLead();
        nextStep();
      });
    });

    // Phone formatting
    const phoneInput = document.getElementById('funnel-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        let digits = e.target.value.replace(/\D/g, '');
        if (digits.length <= 3) {
          e.target.value = digits;
        } else if (digits.length <= 6) {
          e.target.value = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
        } else {
          e.target.value = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
        }
      });
    }

    // Enter key for text input
    const textInput = document.getElementById('funnel-input');
    if (textInput && textInput.tagName === 'TEXTAREA') {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const submitBtn = document.querySelector('[data-action="submit-text"]');
          if (submitBtn) submitBtn.click();
        }
      });
    }

    // Focus input if present
    const input = document.getElementById('funnel-input') || document.getElementById('funnel-name');
    if (input) setTimeout(() => input.focus(), 100);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function saveAnswer(stepId, value) {
    answers[stepId] = value;
  }

  function nextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
      render();
    }
  }

  async function saveLead() {
    if (!answers.email && !answers.phone && !answers.name && Object.keys(answers).length === 0) return;
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-funnel-lead`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          funnel_id: funnel.id,
          team_id: funnel.team_id,
          lead_id: leadId,
          answers: answers,
          email: answers.email,
          phone: answers.phone,
          name: answers.name,
          opt_in_status: answers.opt_in,
          calendly_booking_data: calendlyBookingData,
          utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign')
        })
      });
      
      const data = await response.json();
      if (data.lead_id) leadId = data.lead_id;
    } catch (err) {
      console.error('Failed to save lead:', err);
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
