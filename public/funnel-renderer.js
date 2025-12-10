/**
 * Funnel Client-Side Renderer
 * This file is loaded by the VPS and handles all funnel rendering client-side.
 * Updates to this file automatically deploy - no VPS changes needed.
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
    } catch (err) {
      console.error('Funnel load error:', err);
      showError('Failed to connect to server');
    }
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

  function render() {
    const settings = funnel.settings || {};
    const bgColor = settings.background_color || '#000000';
    const primaryColor = settings.primary_color || '#8B5CF6';
    const buttonText = settings.button_text || 'Continue';

    const step = steps[currentStep];
    const content = step?.content || {};
    const stepType = step?.step_type || 'welcome';

    document.getElementById('funnel-app').innerHTML = `
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
    const primaryColor = settings.primary_color || '#8B5CF6';
    const buttonText = settings.button_text || 'Continue';

    // Check for dynamic elements first
    if (content.element_order && content.dynamic_elements) {
      return renderDynamicElements(content, settings);
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

  function renderDynamicElements(content, settings) {
    const elements = content.dynamic_elements || {};
    const order = content.element_order || [];
    const primaryColor = settings.primary_color || '#8B5CF6';

    return order.map(id => {
      const el = elements[id];
      if (!el) return '';

      switch (el.type) {
        case 'headline':
          return `<h1 style="font-size:${el.fontSize || '2rem'};font-weight:bold;color:${el.color || '#fff'};margin-bottom:1rem;line-height:1.2;">${el.text || ''}</h1>`;
        
        case 'text':
          return `<p style="font-size:${el.fontSize || '1rem'};color:${el.color || '#ccc'};margin-bottom:1rem;line-height:1.6;">${el.text || ''}</p>`;
        
        case 'button':
          return `<button class="funnel-btn" data-action="next" style="background:${el.backgroundColor || primaryColor};color:${el.textColor || '#fff'};padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;margin-top:1rem;width:100%;max-width:300px;">${el.text || 'Continue'}</button>`;
        
        case 'image':
          return el.src ? `<img src="${escapeHtml(el.src)}" alt="" style="max-width:100%;border-radius:${el.borderRadius || '8px'};margin:1rem 0;">` : '';
        
        case 'video':
          return renderVideoEmbed(el.url || content.video_url);
        
        case 'embed':
          return el.url ? `<div style="width:100%;margin:1rem 0;"><iframe src="${escapeHtml(el.url)}" style="width:100%;height:${el.height || '500px'};border:none;border-radius:8px;transform:scale(${el.scale || 0.75});transform-origin:top center;"></iframe></div>` : '';
        
        case 'divider':
          return `<hr style="border:none;border-top:1px solid ${el.color || '#333'};margin:${el.spacing || '2rem'} 0;">`;
        
        case 'input':
          return renderInputElement(el, content, settings);
        
        default:
          return '';
      }
    }).join('');
  }

  function renderInputElement(el, content, settings) {
    const inputType = el.inputType || content.inputType || 'text';
    const placeholder = el.placeholder || content.placeholder || '';
    const primaryColor = settings.primary_color || '#8B5CF6';

    if (inputType === 'email') {
      return `
        <input type="email" id="funnel-input" placeholder="${escapeHtml(placeholder || 'Enter your email')}" 
          style="width:100%;padding:1rem;border:1px solid #333;border-radius:8px;background:#1a1a1a;color:#fff;font-size:1rem;margin-bottom:1rem;">
        <button class="funnel-btn" data-action="submit-email" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${settings.button_text || 'Continue'}</button>
      `;
    } else if (inputType === 'phone') {
      return `
        <input type="tel" id="funnel-input" placeholder="${escapeHtml(placeholder || 'Enter your phone')}" 
          style="width:100%;padding:1rem;border:1px solid #333;border-radius:8px;background:#1a1a1a;color:#fff;font-size:1rem;margin-bottom:1rem;">
        <button class="funnel-btn" data-action="submit-phone" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${settings.button_text || 'Continue'}</button>
      `;
    } else {
      return `
        <textarea id="funnel-input" placeholder="${escapeHtml(placeholder)}" rows="3"
          style="width:100%;padding:1rem;border:1px solid #333;border-radius:8px;background:#1a1a1a;color:#fff;font-size:1rem;margin-bottom:1rem;resize:none;"></textarea>
        <button class="funnel-btn" data-action="submit-text" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${settings.button_text || 'Continue'}</button>
      `;
    }
  }

  function renderWelcome(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    return `
      <h1 style="font-size:2rem;font-weight:bold;color:#fff;margin-bottom:1rem;">${escapeHtml(content.headline || 'Welcome')}</h1>
      ${content.subtext ? `<p style="color:#aaa;margin-bottom:2rem;font-size:1.1rem;">${escapeHtml(content.subtext)}</p>` : ''}
      <button class="funnel-btn" data-action="next" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">${escapeHtml(content.button_text || settings.button_text || 'Get Started')}</button>
    `;
  }

  function renderTextQuestion(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;">${escapeHtml(content.headline || 'Your answer')}</h2>
      ${content.subtext ? `<p style="color:#aaa;margin-bottom:1.5rem;">${escapeHtml(content.subtext)}</p>` : ''}
      <textarea id="funnel-input" placeholder="${escapeHtml(content.placeholder || 'Type your answer...')}" rows="3"
        style="width:100%;padding:1rem;border:1px solid #333;border-radius:8px;background:#1a1a1a;color:#fff;font-size:1rem;margin-bottom:1rem;resize:none;"></textarea>
      <button class="funnel-btn" data-action="submit-text" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${escapeHtml(settings.button_text || 'Continue')}</button>
    `;
  }

  function renderMultiChoice(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    const options = content.options || [];
    
    return `
      <p style="color:#888;margin-bottom:0.5rem;font-size:0.9rem;">Question ${currentStep + 1} of ${steps.length}</p>
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1.5rem;">${escapeHtml(content.headline || 'Choose an option')}</h2>
      <div class="options-container" style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.5rem;">
        ${options.map((opt, i) => `
          <button class="option-btn" data-value="${escapeHtml(opt.value || opt.label || opt)}" 
            style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:1rem;color:#fff;cursor:pointer;text-align:left;display:flex;align-items:center;gap:0.75rem;transition:all 0.2s;">
            ${opt.emoji ? `<span style="font-size:1.5rem;">${opt.emoji}</span>` : ''}
            <span>${escapeHtml(opt.label || opt)}</span>
          </button>
        `).join('')}
      </div>
      <button class="funnel-btn" data-action="submit-choice" disabled style="background:#333;color:#666;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:not-allowed;width:100%;">Next Question</button>
    `;
  }

  function renderEmailCapture(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;">${escapeHtml(content.headline || 'Enter your email')}</h2>
      ${content.subtext ? `<p style="color:#aaa;margin-bottom:1.5rem;">${escapeHtml(content.subtext)}</p>` : ''}
      <input type="email" id="funnel-input" placeholder="${escapeHtml(content.placeholder || 'your@email.com')}" 
        style="width:100%;padding:1rem;border:1px solid #333;border-radius:8px;background:#1a1a1a;color:#fff;font-size:1rem;margin-bottom:1rem;">
      <button class="funnel-btn" data-action="submit-email" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${escapeHtml(settings.button_text || 'Continue')}</button>
    `;
  }

  function renderPhoneCapture(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;">${escapeHtml(content.headline || 'Enter your phone')}</h2>
      ${content.subtext ? `<p style="color:#aaa;margin-bottom:1.5rem;">${escapeHtml(content.subtext)}</p>` : ''}
      <input type="tel" id="funnel-input" placeholder="${escapeHtml(content.placeholder || '(555) 555-5555')}" 
        style="width:100%;padding:1rem;border:1px solid #333;border-radius:8px;background:#1a1a1a;color:#fff;font-size:1rem;margin-bottom:1rem;">
      <button class="funnel-btn" data-action="submit-phone" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${escapeHtml(settings.button_text || 'Continue')}</button>
    `;
  }

  function renderVideo(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;">${escapeHtml(content.headline || '')}</h2>
      ${renderVideoEmbed(content.video_url)}
      <button class="funnel-btn" data-action="next" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;margin-top:1.5rem;">${escapeHtml(content.button_text || settings.button_text || 'Continue')}</button>
    `;
  }

  function renderVideoEmbed(url) {
    if (!url) return '';
    const embedUrl = getEmbedUrl(url);
    return `<div style="width:100%;aspect-ratio:16/9;margin:1rem 0;"><iframe src="${escapeHtml(embedUrl)}" style="width:100%;height:100%;border:none;border-radius:8px;" allowfullscreen></iframe></div>`;
  }

  function getEmbedUrl(url) {
    if (!url) return '';
    
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    
    // Wistia
    const wistiaMatch = url.match(/wistia\.com\/(?:medias|embed)\/([a-zA-Z0-9]+)/);
    if (wistiaMatch) return `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}?autoPlay=true`;
    
    // Loom
    const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
    
    return url;
  }

  function renderEmbed(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    const embedUrl = content.embed_url || '';
    const isCalendly = embedUrl.includes('calendly.com');
    
    return `
      ${content.headline ? `<h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1rem;">${escapeHtml(content.headline)}</h2>` : ''}
      ${content.subtext ? `<p style="color:#aaa;margin-bottom:1rem;">${escapeHtml(content.subtext)}</p>` : ''}
      <div style="width:100%;margin:1rem 0;">
        <iframe id="embed-frame" src="${escapeHtml(embedUrl)}" style="width:100%;height:650px;border:none;border-radius:8px;"></iframe>
      </div>
      ${!isCalendly ? `<button class="funnel-btn" data-action="next" style="background:${primaryColor};color:#fff;padding:1rem 2rem;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">${escapeHtml(settings.button_text || 'Continue')}</button>` : ''}
    `;
  }

  function renderOptIn(content, settings) {
    const design = content.design || {};
    const primaryColor = settings.primary_color || '#8B5CF6';
    const isRequired = content.is_required !== false;
    
    // Input styling from design - matching React OptInStep exactly
    const inputBg = design.inputBg || '#ffffff';
    const inputTextColor = design.inputTextColor || '#0a0a0a';
    const inputBorder = design.inputBorder || '#e5e7eb';
    const inputBorderWidth = design.inputBorderWidth || 1;
    const inputRadius = design.inputRadius || 12;
    const inputPlaceholderColor = design.inputPlaceholderColor || '#9ca3af';
    const showInputIcon = design.inputShowIcon !== false;
    
    // Button styling from design
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
    
    // Input icons
    const nameIcon = content.name_icon || '👋';
    const emailIcon = content.email_icon || '✉️';
    const phoneIcon = content.phone_icon || '🇺🇸';
    
    const inputContainerStyle = `display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:${inputBg};border:${inputBorderWidth}px solid ${inputBorder};border-radius:${inputRadius}px;margin-bottom:0.25rem;`;
    const inputFieldStyle = `flex:1;border:none;background:transparent;color:${inputTextColor};font-size:1rem;outline:none;`;
    
    return `
      <h2 style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:1.5rem;" dangerouslySetInnerHTML>${content.headline || 'Get Started'}</h2>
      <div style="display:flex;flex-direction:column;gap:0.25rem;margin-bottom:1rem;">
        <div id="name-container" style="${inputContainerStyle}">
          ${showInputIcon ? `<span style="font-size:1.25rem;flex-shrink:0;">${nameIcon}</span>` : ''}
          <input type="text" id="funnel-name" placeholder="${escapeHtml(content.name_placeholder || 'Your name')}" 
            style="${inputFieldStyle}" data-required="${isRequired}">
        </div>
        <div id="name-error" style="color:#f87171;font-size:0.75rem;margin-bottom:0.5rem;display:none;"></div>
        
        <div id="email-container" style="${inputContainerStyle}">
          ${showInputIcon ? `<span style="font-size:1.25rem;flex-shrink:0;">${emailIcon}</span>` : ''}
          <input type="email" id="funnel-email" placeholder="${escapeHtml(content.email_placeholder || 'Your email address')}" 
            style="${inputFieldStyle}" data-required="${isRequired}">
        </div>
        <div id="email-error" style="color:#f87171;font-size:0.75rem;margin-bottom:0.5rem;display:none;"></div>
        
        <div id="phone-container" style="${inputContainerStyle}">
          ${showInputIcon ? `<span style="font-size:1.25rem;flex-shrink:0;">${phoneIcon}</span>` : ''}
          <span style="color:${inputPlaceholderColor};font-size:0.875rem;flex-shrink:0;">+1</span>
          <input type="tel" id="funnel-phone" placeholder="${escapeHtml(content.phone_placeholder || 'Your phone number')}" 
            style="${inputFieldStyle}" data-required="${isRequired}" maxlength="14">
        </div>
        <div id="phone-error" style="color:#f87171;font-size:0.75rem;margin-bottom:0.5rem;display:none;"></div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:0.75rem;margin-bottom:1.5rem;cursor:pointer;color:rgba(255,255,255,0.8);font-size:0.875rem;">
        <input type="checkbox" id="funnel-consent" style="margin-top:2px;accent-color:${primaryColor};">
        <span>${content.privacy_text || 'I have read and accept the'} ${content.privacy_link ? `<a href="${escapeHtml(content.privacy_link)}" target="_blank" style="color:#fff;text-decoration:underline;">privacy policy</a>` : '<span style="text-decoration:underline;">privacy policy</span>'}.</span>
      </label>
      <button class="funnel-btn" data-action="submit-optin" data-required="${isRequired}" style="${buttonStyle}padding:1rem 2rem;border:none;font-size:1rem;font-weight:600;cursor:pointer;width:100%;">${escapeHtml(content.submit_button_text || content.button_text || settings.button_text || 'Submit')}</button>
    `;
  }

  function renderThankYou(content, settings) {
    const primaryColor = settings.primary_color || '#8B5CF6';
    
    // Auto-redirect if configured
    if (content.redirect_url) {
      setTimeout(() => {
        window.location.href = content.redirect_url;
      }, 3000);
    }
    
    return `
      <div style="color:${primaryColor};font-size:4rem;margin-bottom:1.5rem;">✓</div>
      <h1 style="font-size:2rem;font-weight:bold;color:#fff;margin-bottom:1rem;">${escapeHtml(content.headline || 'Thank You!')}</h1>
      ${content.subtext ? `<p style="color:#aaa;font-size:1.1rem;">${escapeHtml(content.subtext)}</p>` : ''}
      ${content.redirect_url ? `<p style="color:#666;margin-top:2rem;font-size:0.9rem;">Redirecting in 3 seconds...</p>` : ''}
    `;
  }

  function renderProgressDots() {
    return `
      <div style="display:flex;gap:0.5rem;margin-top:2rem;">
        ${steps.map((_, i) => `
          <div style="width:8px;height:8px;border-radius:50%;background:${i === currentStep ? '#fff' : '#333'};transition:background 0.3s;"></div>
        `).join('')}
      </div>
    `;
  }

  function attachEventListeners(step, settings) {
    // Next buttons
    document.querySelectorAll('[data-action="next"]').forEach(btn => {
      btn.addEventListener('click', () => nextStep());
    });

    // Text submission
    document.querySelectorAll('[data-action="submit-text"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('funnel-input');
        if (input && input.value.trim()) {
          saveAnswer(step.id, input.value.trim());
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
        } else {
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
          b.style.borderColor = '#333';
          b.style.background = '#1a1a1a';
        });
        btn.style.borderColor = settings.primary_color || '#8B5CF6';
        btn.style.background = '#2a2a2a';
        selectedOption = btn.dataset.value;
        
        const submitBtn = document.querySelector('[data-action="submit-choice"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.background = settings.primary_color || '#8B5CF6';
          submitBtn.style.color = '#fff';
          submitBtn.style.cursor = 'pointer';
        }
      });
    });

    document.querySelectorAll('[data-action="submit-choice"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (selectedOption) {
          saveAnswer(step.id, selectedOption);
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
          if (errorEl) errorEl.style.display = 'none';
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

    // Calendly listener
    window.addEventListener('message', (e) => {
      if (e.data.event === 'calendly.event_scheduled') {
        answers.calendly_booking = {
          event_time: e.data.payload?.event?.start_time,
          invitee_uri: e.data.payload?.invitee?.uri
        };
        saveLead();
        setTimeout(() => nextStep(), 1500);
      }
    });

    // Focus input if present
    const input = document.getElementById('funnel-input');
    if (input) input.focus();
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
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/submit-funnel-lead`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          funnel_id: funnel.id,
          lead_id: leadId,
          answers: answers,
          email: answers.email,
          phone: answers.phone,
          name: answers.name,
          opt_in_status: answers.opt_in,
          calendly_booking_data: answers.calendly_booking,
          utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign')
        })
      });
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
