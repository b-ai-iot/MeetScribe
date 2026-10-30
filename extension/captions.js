// MeetScribe - Native caption discovery, ranking and recovery
(function(global) {
  'use strict';

  // Platform specific and generic selectors with priority scores
  const CANDIDATE_SELECTORS = [
    // Google Meet (high priority exact labels and classes)
    { sel: 'div[aria-label="Phụ đề"]', score: 100, platform: 'meet', confidence: 'high' },
    { sel: 'div[aria-label="Captions"]', score: 100, platform: 'meet', confidence: 'high' },
    { sel: '.nM9E9c', score: 95, platform: 'meet', confidence: 'high' },
    { sel: '.a4bPe', score: 90, platform: 'meet', confidence: 'high' },
    { sel: '.VbkSUe', score: 90, platform: 'meet', confidence: 'high' },
    { sel: 'div[jsname="YSxPC"]', score: 90, platform: 'meet', confidence: 'high' },
    { sel: '[role="region"][aria-label*="caption" i]', score: 85, platform: 'meet', confidence: 'high' },
    { sel: '[role="region"][aria-label*="phụ đề" i]', score: 85, platform: 'meet', confidence: 'high' },

    // Zoom (high priority subtitle box and transcript container)
    { sel: '#live-transcription-subtitle', score: 100, platform: 'zoom', confidence: 'high' },
    { sel: '.live-transcription-subtitle__box', score: 100, platform: 'zoom', confidence: 'high' },
    { sel: '.live-transcription-subtitle', score: 95, platform: 'zoom', confidence: 'high' },
    { sel: '.transcript-container__transcripts', score: 90, platform: 'zoom', confidence: 'high' },
    { sel: '.transcript-container', score: 85, platform: 'zoom', confidence: 'high' },
    { sel: '[role="log"][aria-label*="transcript" i]', score: 85, platform: 'zoom', confidence: 'high' },
    { sel: '[role="log"][aria-label*="closed caption" i]', score: 85, platform: 'zoom', confidence: 'high' },
    { sel: '.closed-caption-container', score: 85, platform: 'zoom', confidence: 'high' },
    { sel: '.subtitle-window', score: 80, platform: 'zoom', confidence: 'high' },

    // Generic live caption fallback (requires caption/subtitle in attributes or classes)
    { sel: '[role="log"][aria-label*="caption" i]', score: 75, platform: 'generic', confidence: 'medium' },
    { sel: '[role="region"][aria-label*="subtitles" i]', score: 75, platform: 'generic', confidence: 'medium' },

    // Low confidence generic aria-live (must NEVER auto-select on their own)
    { sel: 'div[jscontroller][aria-live="polite"]', score: 45, platform: 'generic', confidence: 'low' },
    { sel: 'div[aria-live="polite"][aria-atomic="true"]', score: 45, platform: 'generic', confidence: 'low' },
    { sel: '[aria-live="polite"]', score: 40, platform: 'generic', confidence: 'low' },
    { sel: '[aria-live="assertive"]', score: 35, platform: 'generic', confidence: 'low' }
  ];

  function isExclusionElement(el) {
    if (!el || typeof el !== 'object') return true;

    // Check tag name: reject body, html, main, nav, header, footer
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER') {
      return true;
    }

    // MeetScribe toolbar and UI
    if (tag === 'MEETSCRIBE-TOOLBAR' || el.closest?.('meetscribe-toolbar')) {
      return true;
    }
    const id = el.id || '';
    if (id.startsWith('meetscribe') || id.includes('meetscribe-')) {
      return true;
    }
    const cls = typeof el.className === 'string' ? el.className : '';
    if (cls.includes('meetscribe')) {
      return true;
    }

    // Status toasts, alerts, and join notifications without caption evidence
    const label = (el.getAttribute?.('aria-label') || '').toLowerCase();
    const role = (el.getAttribute?.('role') || '').toLowerCase();
    const hasCaptionWord = /caption|phụ đề|transcript|subtitles/i.test(label);

    if (!hasCaptionWord && (role === 'status' || role === 'alert')) {
      return true;
    }
    if (el.closest?.('.toast, .snackbar, [role="alert"], .zm-modal-body')) {
      return true;
    }

    // Known meeting status/join/leave toast text
    const text = (el.innerText || el.textContent || '').trim();
    if (/^(you joined|you have left|bạn đã tham gia|bạn đã rời|microphone is|đã tắt mic|đã bật mic|rời cuộc họp)/i.test(text)) {
      if (!hasCaptionWord) return true;
    }

    // Chat / messaging elements
    const isChatKeyword = /chat|trò chuyện|tin nhắn|message|conversation/i.test(label) ||
      /chat|trò chuyện|tin nhắn|message/i.test(id) ||
      /chat|trò chuyện|tin nhắn/i.test(cls);

    if (isChatKeyword && (role === 'log' || role === 'region' || id.includes('chat') || cls.includes('chat'))) {
      return true;
    }
    if (el.closest?.('#chat, .chat-container, .chat-box, .chat-window, [role="log"][aria-label*="chat" i], [aria-label*="trò chuyện" i], [aria-label*="tin nhắn" i], [aria-label*="chat" i], .conversation-panel')) {
      return true;
    }

    // Participant / people lists
    const isParticipant = /người tham gia|participants|people|member/i.test(label) ||
      /participant|people/i.test(id) ||
      /participant|people/i.test(cls);
    if (isParticipant) {
      return true;
    }
    if (el.closest?.('[aria-label*="người tham gia" i], [aria-label*="participants" i], [aria-label*="people" i], [role="list"][aria-label*="participant" i]')) {
      return true;
    }

    // Meeting controls / action toolbar
    if (el.closest?.('[role="toolbar"], [role="navigation"]')) {
      return true;
    }

    return false;
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;

    // Check style on element and ancestors
    let curr = el;
    while (curr && curr.nodeType !== 9 /* DOCUMENT_NODE */) {
      if (curr.style) {
        if (curr.style.display === 'none' || curr.style.visibility === 'hidden') {
          return false;
        }
      }
      if (typeof global.getComputedStyle === 'function') {
        try {
          const s = global.getComputedStyle(curr);
          if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') {
            return false;
          }
        } catch {}
      }
      curr = curr.parentElement;
    }

    // Check bounding rect if available
    if (typeof el.getBoundingClientRect === 'function') {
      try {
        const r = el.getBoundingClientRect();
        if (r && typeof r.width === 'number' && typeof r.height === 'number') {
          if (r.width === 0 && r.height === 0) {
            if (typeof global.getComputedStyle === 'function') {
              return false;
            }
          }
        }
      } catch {}
    }

    return true;
  }

  function rankCaptionCandidates(root) {
    const doc = root?.querySelectorAll ? root : (root?.ownerDocument || global.document);
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];

    const candidatesMap = new Map();

    for (const rule of CANDIDATE_SELECTORS) {
      let elements = [];
      try {
        elements = [...doc.querySelectorAll(rule.sel)];
      } catch {}

      for (const el of elements) {
        if (isExclusionElement(el)) continue;
        if (!isElementVisible(el)) continue;

        const existing = candidatesMap.get(el);
        if (!existing || rule.score > existing.score) {
          candidatesMap.set(el, {
            element: el,
            score: rule.score,
            confidence: rule.confidence,
            platform: rule.platform,
            reason: `Matched selector: ${rule.sel} (${rule.confidence})`
          });
        }
      }
    }

    const sorted = [...candidatesMap.values()].sort((a, b) => b.score - a.score);
    return sorted;
  }

  // Groups candidates into widgets by hierarchical containment (parent contains child)
  // and selects the OUTER-most container for each widget to retain full speaker context.
  function groupCandidatesIntoWidgets(candidates) {
    const widgets = [];
    for (const candidate of candidates) {
      let merged = false;
      for (const widget of widgets) {
        // If candidate element is ancestor or descendant of any element in widget
        const isRelated = widget.members.some(m =>
          m.element === candidate.element ||
          m.element.contains?.(candidate.element) ||
          candidate.element.contains?.(m.element)
        );
        if (isRelated) {
          widget.members.push(candidate);
          if (candidate.score > widget.score) {
            widget.score = candidate.score;
            widget.confidence = candidate.confidence;
            widget.platform = candidate.platform;
          }
          // Update outer-most element
          if (candidate.element.contains?.(widget.element)) {
            widget.element = candidate.element;
          }
          merged = true;
          break;
        }
      }
      if (!merged) {
        widgets.push({
          element: candidate.element,
          score: candidate.score,
          confidence: candidate.confidence,
          platform: candidate.platform,
          members: [candidate]
        });
      }
    }

    // Sort widgets descending by score
    widgets.sort((a, b) => b.score - a.score);
    return widgets;
  }

  function findCaptionContainer(root) {
    const rawCandidates = rankCaptionCandidates(root);

    if (rawCandidates.length === 0) {
      return {
        container: null,
        confidence: 'none',
        status: 'none',
        candidates: []
      };
    }

    const widgets = groupCandidatesIntoWidgets(rawCandidates);

    // If top widget has low confidence (score < 70, e.g. generic aria-live/toast)
    // Never auto-select it without caption-specific semantic evidence!
    if (widgets[0].confidence === 'low' || widgets[0].score < 70) {
      return {
        container: null,
        confidence: widgets[0].confidence,
        status: 'none',
        candidates: rawCandidates
      };
    }

    if (widgets.length === 1) {
      return {
        container: widgets[0].element,
        confidence: widgets[0].confidence,
        status: 'found',
        candidates: rawCandidates
      };
    }

    const first = widgets[0];
    const second = widgets[1];

    // Since first and second are distinct widgets, they are DISJOINT!
    // Equal high score or close scores (within 10 points) between disjoint widgets must be ambiguous!
    if (Math.abs(first.score - second.score) <= 10) {
      return {
        container: null,
        confidence: first.confidence,
        status: 'ambiguous',
        candidates: rawCandidates
      };
    }

    // First is unambiguously higher
    if (first.score > second.score + 10) {
      return {
        container: first.element,
        confidence: first.confidence,
        status: 'found',
        candidates: rawCandidates
      };
    }

    return {
      container: null,
      confidence: first.confidence,
      status: 'ambiguous',
      candidates: rawCandidates
    };
  }

  function reacquireCaptionContainer(current, root, options = {}) {
    // If current container is still connected, visible, and not an exclusion element
    if (current && isElementVisible(current) && !isExclusionElement(current)) {
      return {
        container: current,
        replaced: false,
        confidence: 'high'
      };
    }

    // Current is lost or invalid; look for replacement
    const result = findCaptionContainer(root);
    // ONLY bind if status is unambiguously 'found' and confidence is high or medium
    if (result.status === 'found' && result.container && result.confidence !== 'low') {
      return {
        container: result.container,
        replaced: result.container !== current,
        confidence: result.confidence
      };
    }

    return {
      container: null,
      replaced: false,
      confidence: 'none',
      ambiguous: result.status === 'ambiguous'
    };
  }

  function highlightCaptionRegion(el, durationMs = 2000) {
    if (!el || typeof el !== 'object') return () => {};

    const doc = el.ownerDocument || global.document;
    let overlay = null;

    try {
      if (doc && typeof doc.createElement === 'function' && typeof el.getBoundingClientRect === 'function') {
        const rect = el.getBoundingClientRect();
        overlay = doc.createElement('div');
        overlay.style.cssText = `position:fixed;left:${rect.left || 0}px;top:${rect.top || 0}px;width:${rect.width || 0}px;height:${rect.height || 0}px;z-index:2147483640;pointer-events:none;border:3px solid #59e2c0;box-shadow:0 0 16px rgba(89,226,192,0.6);border-radius:6px;transition:opacity 0.3s ease;`;
        const container = doc.body || doc.documentElement;
        if (container && typeof container.appendChild === 'function') {
          container.appendChild(overlay);
        }
      }
    } catch {}

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (overlay && overlay.remove) {
        overlay.remove();
      }
    };

    if (durationMs > 0 && typeof global.setTimeout === 'function') {
      global.setTimeout(cleanup, durationMs);
    }

    return cleanup;
  }

  const api = {
    findCaptionContainer,
    rankCaptionCandidates,
    isExclusionElement,
    isElementVisible,
    highlightCaptionRegion,
    reacquireCaptionContainer
  };

  global.__meetScribeCaptions = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
