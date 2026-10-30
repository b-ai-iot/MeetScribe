import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findCaptionContainer,
  rankCaptionCandidates,
  isExclusionElement,
  isElementVisible,
  highlightCaptionRegion,
  reacquireCaptionContainer
} from '../extension/captions.mjs';

// Minimal mock DOM node for testing caption discovery heuristics
class MockElement {
  constructor({
    tagName = 'DIV',
    id = '',
    className = '',
    attributes = {},
    innerText = '',
    style = {},
    rect = { width: 400, height: 60, top: 800, left: 300, right: 700, bottom: 860 },
    isConnected = true
  } = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = className;
    this.attributes = { ...attributes };
    if (id) this.attributes.id = id;
    if (className) this.attributes.class = className;
    this.innerText = innerText;
    this.textContent = innerText;
    this.style = { ...style };
    this._rect = rect;
    this.isConnected = isConnected;
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  get classList() {
    const tokens = new Set((this.className || '').split(/\s+/).filter(Boolean));
    return {
      contains: token => tokens.has(token),
      add: token => { tokens.add(token); this.className = [...tokens].join(' '); },
      remove: token => { tokens.delete(token); this.className = [...tokens].join(' '); }
    };
  }

  appendChild(child) {
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const c of children) this.appendChild(c);
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  getBoundingClientRect() {
    return { ...this._rect };
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  contains(other) {
    let curr = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  matches(sel) {
    if (!sel) return false;
    // Check multiple selectors comma-separated
    if (sel.includes(',')) {
      return sel.split(',').map(s => s.trim()).some(s => this.matches(s));
    }
    // Tag check
    const tagMatch = sel.match(/^([a-zA-Z0-9-]+)/);
    if (tagMatch && tagMatch[1].toUpperCase() !== this.tagName) return false;

    // ID check
    const idMatch = sel.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch && this.id !== idMatch[1]) return false;

    // Class check
    const classMatches = [...sel.matchAll(/\.([a-zA-Z0-9_-]+)/g)];
    for (const [, cls] of classMatches) {
      if (!this.classList.contains(cls)) return false;
    }

    // Attribute exact check: [attr="val"]
    const attrExactMatches = [...sel.matchAll(/\[([a-zA-Z0-9_-]+)="([^"]*)"\]/g)];
    for (const [, attr, val] of attrExactMatches) {
      if (this.getAttribute(attr) !== val) return false;
    }

    // Attribute contains check: [attr*="val" i]
    const attrContainsMatches = [...sel.matchAll(/\[([a-zA-Z0-9_-]+)\*="([^"]*)"(?:\s*i)?\]/g)];
    for (const [, attr, val] of attrContainsMatches) {
      const v = this.getAttribute(attr);
      if (!v || !v.toLowerCase().includes(val.toLowerCase())) return false;
    }

    // Bare attribute check: [attr]
    const bareAttrMatches = [...sel.matchAll(/\[([a-zA-Z0-9_-]+)\]/g)];
    for (const [, attr] of bareAttrMatches) {
      if (!this.hasAttribute(attr)) return false;
    }

    return true;
  }

  querySelectorAll(sel) {
    const results = [];
    const walk = node => {
      for (const child of node.children) {
        if (child.matches(sel)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
}

function createMockDocument() {
  const html = new MockElement({ tagName: 'html' });
  const body = new MockElement({ tagName: 'body' });
  html.appendChild(body);
  return {
    documentElement: html,
    body,
    querySelectorAll: sel => html.querySelectorAll(sel),
    querySelector: sel => html.querySelector(sel),
    createElement: tag => new MockElement({ tagName: tag })
  };
}

test('captions: finds known Google Meet caption containers with high confidence', () => {
  const doc = createMockDocument();
  const meetContainer = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Nguyễn Văn A: Xin chào mọi người',
    rect: { width: 500, height: 80, top: 700, left: 200, right: 700, bottom: 780 }
  });
  doc.body.appendChild(meetContainer);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'found');
  assert.equal(result.confidence, 'high');
  assert.equal(result.container, meetContainer);
});

test('captions: finds Google Meet english captions and obfuscated classes', () => {
  const doc = createMockDocument();
  const captions = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Captions' },
    innerText: 'Alice: Hello everyone'
  });
  doc.body.appendChild(captions);

  const res1 = findCaptionContainer(doc);
  assert.equal(res1.status, 'found');
  assert.equal(res1.confidence, 'high');
  assert.equal(res1.container, captions);

  // Meet class selector
  const doc2 = createMockDocument();
  const meetClass = new MockElement({
    tagName: 'div',
    className: 'nM9E9c',
    innerText: 'Bob: Live transcript'
  });
  doc2.body.appendChild(meetClass);
  const res2 = findCaptionContainer(doc2);
  assert.equal(res2.status, 'found');
  assert.equal(res2.container, meetClass);
});

test('captions: finds Zoom subtitle container and box', () => {
  const doc = createMockDocument();
  const zoomBox = new MockElement({
    tagName: 'div',
    className: 'live-transcription-subtitle__box',
    innerText: 'Host: Meeting is starting'
  });
  doc.body.appendChild(zoomBox);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'found');
  assert.equal(result.confidence, 'high');
  assert.equal(result.container, zoomBox);
});

test('captions: strictly excludes chat, participant panels, toolbar and full page', () => {
  const doc = createMockDocument();

  // Chat region
  const chat = new MockElement({
    tagName: 'div',
    id: 'chat-container',
    attributes: { role: 'log', 'aria-label': 'Trò chuyện trong cuộc gọi' },
    innerText: 'Alice: Hãy xem slide số 3 nhé'
  });
  doc.body.appendChild(chat);
  assert.equal(isExclusionElement(chat), true);

  // MeetScribe toolbar element
  const toolbar = new MockElement({
    tagName: 'meetscribe-toolbar',
    innerText: 'MeetScribe'
  });
  const toolbarChild = new MockElement({
    tagName: 'div',
    className: 'meetscribe-status',
    innerText: 'Chờ caption'
  });
  toolbar.appendChild(toolbarChild);
  doc.body.appendChild(toolbar);
  assert.equal(isExclusionElement(toolbarChild), true);

  // Participant list
  const participants = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Người tham gia' },
    innerText: '5 người'
  });
  doc.body.appendChild(participants);
  assert.equal(isExclusionElement(participants), true);

  // Full body / html
  assert.equal(isExclusionElement(doc.body), true);
  assert.equal(isExclusionElement(doc.documentElement), true);

  // When only chat exists, discovery should not pick chat as caption
  const result = findCaptionContainer(doc);
  assert.notEqual(result.container, chat);
  assert.equal(result.status, 'none');
});

test('captions: rejects disconnected or hidden elements', () => {
  const doc = createMockDocument();
  const hiddenNode = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    style: { display: 'none' },
    innerText: 'Hidden text'
  });
  doc.body.appendChild(hiddenNode);

  const res1 = findCaptionContainer(doc);
  assert.equal(res1.status, 'none');

  // Disconnected
  const disconnected = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    isConnected: false,
    innerText: 'Disconnected text'
  });
  const res2 = findCaptionContainer(disconnected);
  assert.equal(res2.status, 'none');
});

test('captions: silence in meeting keeps container valid (not missing source)', () => {
  const doc = createMockDocument();
  const emptyCaptionBox = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: '', // silence
    rect: { width: 400, height: 60, top: 800, left: 300, right: 700, bottom: 860 },
    isConnected: true
  });
  doc.body.appendChild(emptyCaptionBox);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'found');
  assert.equal(result.container, emptyCaptionBox);
});

test('captions: handles ambiguity when competing candidate elements exist', () => {
  const doc = createMockDocument();
  // Two competing candidate elements with same score
  const candidate1 = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Candidate one message'
  });
  const candidate2 = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Candidate two message'
  });
  doc.body.appendChild(candidate1);
  doc.body.appendChild(candidate2);

  const candidates = rankCaptionCandidates(doc);
  assert.ok(candidates.length >= 2);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'ambiguous');
});

test('captions: lone generic status or toast is not auto-selected as caption', () => {
  const doc = createMockDocument();
  const toast = new MockElement({
    tagName: 'div',
    attributes: { 'aria-live': 'polite', role: 'status' },
    innerText: 'You joined the meeting'
  });
  doc.body.appendChild(toast);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'none');
  assert.equal(result.container, null);
});

test('captions: live region inside chat container is excluded', () => {
  const doc = createMockDocument();
  const chatBox = new MockElement({
    tagName: 'div',
    className: 'chat-messages'
  });
  const liveMessage = new MockElement({
    tagName: 'div',
    attributes: { 'aria-live': 'polite' },
    innerText: 'Bob: Hello in chat'
  });
  chatBox.appendChild(liveMessage);
  doc.body.appendChild(chatBox);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'none');
  assert.equal(result.container, null);
});

test('captions: nested candidate elements group into one widget preferring outer container', () => {
  const doc = createMockDocument();
  const outerContainer = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' }, // score 100
    innerText: 'Speaker A: Full subtitle line'
  });
  const innerSpan = new MockElement({
    tagName: 'div',
    className: 'a4bPe', // score 90
    innerText: 'Full subtitle line'
  });
  outerContainer.appendChild(innerSpan);
  doc.body.appendChild(outerContainer);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'found');
  assert.equal(result.container, outerContainer);
});

test('captions: nested candidate does not hide third disjoint equal candidate (ambiguous)', () => {
  const doc = createMockDocument();
  // Widget 1: outer + inner
  const outer1 = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' }, // score 100
    innerText: 'Subtitle 1'
  });
  const inner1 = new MockElement({
    tagName: 'div',
    className: 'a4bPe', // score 90
    innerText: 'Subtitle 1 text'
  });
  outer1.appendChild(inner1);
  doc.body.appendChild(outer1);

  // Widget 2: disjoint outer 2 with score 100
  const outer2 = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' }, // score 100
    innerText: 'Subtitle 2'
  });
  doc.body.appendChild(outer2);

  const result = findCaptionContainer(doc);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.container, null);
});

test('captions: reacquireCaptionContainer refuses to bind ambiguous result during recovery', () => {
  const doc = createMockDocument();
  const oldNode = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Old caption'
  });
  doc.body.appendChild(oldNode);
  oldNode.isConnected = false;

  const cand1 = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Candidate 1'
  });
  const cand2 = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Candidate 2'
  });
  doc.body.appendChild(cand1);
  doc.body.appendChild(cand2);

  const rec = reacquireCaptionContainer(oldNode, doc);
  assert.equal(rec.container, null);
  assert.equal(rec.replaced, false);
  assert.equal(rec.ambiguous, true);
});

test('captions: reacquireCaptionContainer recovers when node is replaced', () => {
  const doc = createMockDocument();
  const oldNode = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Speaker 1: Hi'
  });
  doc.body.appendChild(oldNode);

  // While oldNode is still connected and valid
  const check1 = reacquireCaptionContainer(oldNode, doc);
  assert.equal(check1.replaced, false);
  assert.equal(check1.container, oldNode);

  // Meet re-renders and removes oldNode, creates newNode
  doc.body.removeChild(oldNode);
  oldNode.isConnected = false;

  const newNode = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Speaker 2: Yes, I am here'
  });
  doc.body.appendChild(newNode);

  const check2 = reacquireCaptionContainer(oldNode, doc);
  assert.equal(check2.replaced, true);
  assert.equal(check2.container, newNode);
});

test('captions: highlightCaptionRegion applies non-destructive feedback and cleans up', () => {
  const el = new MockElement({
    tagName: 'div',
    attributes: { 'aria-label': 'Phụ đề' },
    innerText: 'Test caption'
  });

  const cleanup = highlightCaptionRegion(el, 500);
  assert.equal(typeof cleanup, 'function');
  // Highlight sets outline or creates overlay without breaking style
  cleanup();
});

test('captions: generic live ancestor never expands to encompass chat or status', () => {
  const doc = createMockDocument();
  const meeting = new MockElement({
    tagName: 'div',
    id: 'meeting',
    attributes: { 'aria-live': 'polite' },
    innerText: 'PRIVATE CHAT\nSPEECH\nMIC STATUS'
  });
  const chat = new MockElement({
    tagName: 'div',
    id: 'chat',
    attributes: { 'aria-label': 'Chat' },
    innerText: 'PRIVATE CHAT'
  });
  const cap = new MockElement({
    tagName: 'div',
    id: 'cap',
    attributes: { 'aria-label': 'Captions' },
    innerText: 'SPEECH'
  });
  const status = new MockElement({
    tagName: 'div',
    attributes: { role: 'status' },
    innerText: 'MIC STATUS'
  });
  meeting.append(chat, cap, status);
  doc.body.appendChild(meeting);

  const res = findCaptionContainer(doc);
  assert.equal(res.status, 'found');
  assert.equal(res.container, cap);
  assert.notEqual(res.container, meeting);
});

test('captions: opacity 0 is rejected by isElementVisible and detector reacquires visible element', () => {
  const doc = createMockDocument();
  const oldNode = new MockElement({
    tagName: 'div',
    id: 'old',
    attributes: { 'aria-label': 'Captions' },
    style: { opacity: '0' },
    innerText: 'OLD HIDDEN SPEECH'
  });
  const newNode = new MockElement({
    tagName: 'div',
    id: 'new',
    attributes: { 'aria-label': 'Captions' },
    innerText: 'NEW VISIBLE SPEECH'
  });
  doc.body.append(oldNode, newNode);

  assert.equal(isElementVisible(oldNode), false);
  assert.equal(isElementVisible(newNode), true);

  const res = findCaptionContainer(doc);
  assert.equal(res.status, 'found');
  assert.equal(res.container, newNode);
});
