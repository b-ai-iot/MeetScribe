// MeetScribe - ES Module export wrapper for captions detector
import './captions.js';

export const {
  findCaptionContainer,
  rankCaptionCandidates,
  isExclusionElement,
  isElementVisible,
  highlightCaptionRegion,
  reacquireCaptionContainer
} = globalThis.__meetScribeCaptions;
