/**
 * CareBridge "How to Use" Guide Video Verification Suite
 * Validates:
 * 1. No fake or placeholder video URL is configured by default.
 * 2. Video URL can be configured externally (direct MP4/WebM, local path, YouTube, Vimeo) without editing LandingPage.tsx.
 * 3. Unsafe or malformed video URLs are safely rejected.
 * 4. All 7 CareBridge walkthrough text instruction steps are present in order.
 * 5. LandingPage.tsx renders "How to Use" beside "Contact Us" with zero hardcoded video URLs.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CAREBRIDGE_GUIDE_STEPS,
  DEFAULT_GUIDE_VIDEO_CONFIG,
  getGuideVideoConfig,
  resolveGuideVideoSource
} from '../src/config/guideVideo';

function runTests() {
  const passed: string[] = [];
  const check = (name: string, fn: () => void) => {
    fn();
    passed.push(name);
    console.log(`[PASS] ${name}`);
  };

  check('Default configuration points to real CareBridge guide video, VTT captions, and poster assets', () => {
    assert.equal(DEFAULT_GUIDE_VIDEO_CONFIG.videoUrl, '/media/carebridge-how-to-use.mp4');
    assert.equal(DEFAULT_GUIDE_VIDEO_CONFIG.captionsUrl, '/media/carebridge-how-to-use.vtt');
    assert.equal(DEFAULT_GUIDE_VIDEO_CONFIG.posterUrl, '/media/carebridge-how-to-use-poster.png');

    const resolved = resolveGuideVideoSource(DEFAULT_GUIDE_VIDEO_CONFIG.videoUrl);
    assert.equal(resolved.kind, 'direct');
    if (resolved.kind === 'direct') {
      assert.equal(resolved.mimeType, 'video/mp4');
    }

    const publicDir = path.resolve(process.cwd(), 'public');
    const mp4Stats = fs.statSync(path.join(publicDir, 'media/carebridge-how-to-use.mp4'));
    const vttStats = fs.statSync(path.join(publicDir, 'media/carebridge-how-to-use.vtt'));
    const posterStats = fs.statSync(path.join(publicDir, 'media/carebridge-how-to-use-poster.png'));
    assert.ok(mp4Stats.size > 100000, 'Expected real rendered MP4 video asset (>100KB)');
    assert.ok(vttStats.size > 200, 'Expected non-empty WebVTT captions file');
    assert.ok(posterStats.size > 5000, 'Expected rendered PNG poster image');

    assert.equal(resolveGuideVideoSource('').kind, 'unconfigured');
  });

  check('Direct HTTPS and root-relative MP4/WebM video URLs resolve with MIME type', () => {
    const mp4 = resolveGuideVideoSource('https://cdn.carebridge.org/guides/walkthrough.mp4');
    assert.equal(mp4.kind, 'direct');
    if (mp4.kind === 'direct') {
      assert.equal(mp4.src, 'https://cdn.carebridge.org/guides/walkthrough.mp4');
      assert.equal(mp4.mimeType, 'video/mp4');
    }

    const localWebm = resolveGuideVideoSource('/media/carebridge-guide.webm');
    assert.equal(localWebm.kind, 'direct');
    if (localWebm.kind === 'direct') {
      assert.equal(localWebm.src, '/media/carebridge-guide.webm');
      assert.equal(localWebm.mimeType, 'video/webm');
    }
  });

  check('YouTube and Vimeo URLs resolve to responsive embed URLs with captions/inline params', () => {
    const ytWatch = resolveGuideVideoSource('https://www.youtube.com/watch?v=AbCdEfGhIjK');
    assert.equal(ytWatch.kind, 'embed');
    if (ytWatch.kind === 'embed') {
      assert.equal(ytWatch.provider, 'youtube');
      assert.match(ytWatch.embedUrl, /youtube-nocookie\.com\/embed\/AbCdEfGhIjK/);
      assert.match(ytWatch.embedUrl, /playsinline=1/);
      assert.match(ytWatch.embedUrl, /cc_load_policy=1/);
    }

    const ytShort = resolveGuideVideoSource('https://youtu.be/AbCdEfGhIjK');
    assert.equal(ytShort.kind, 'embed');

    const vimeo = resolveGuideVideoSource('https://vimeo.com/123456789');
    assert.equal(vimeo.kind, 'embed');
    if (vimeo.kind === 'embed') {
      assert.equal(vimeo.provider, 'vimeo');
      assert.match(vimeo.embedUrl, /player\.vimeo\.com\/video\/123456789/);
    }
  });

  check('Unsafe and malformed URLs are rejected', () => {
    assert.equal(resolveGuideVideoSource('javascript:alert(1)').kind, 'invalid');
    assert.equal(resolveGuideVideoSource('data:video/mp4;base64,AAAA').kind, 'invalid');
    assert.equal(resolveGuideVideoSource('//evil.example/video.mp4').kind, 'invalid');
    assert.equal(resolveGuideVideoSource('not a valid url').kind, 'invalid');
  });

  check('Config overrides allow configuring video & captions URLs without touching LandingPage.tsx', () => {
    const cfg = getGuideVideoConfig({
      videoUrl: 'https://storage.googleapis.com/carebridge-media/guide.mp4',
      captionsUrl: 'https://storage.googleapis.com/carebridge-media/guide-en.vtt'
    });
    assert.equal(cfg.videoUrl, 'https://storage.googleapis.com/carebridge-media/guide.mp4');
    assert.equal(cfg.captionsUrl, 'https://storage.googleapis.com/carebridge-media/guide-en.vtt');
  });

  check('All 7 suggested CareBridge guide steps are documented in order', () => {
    assert.equal(CAREBRIDGE_GUIDE_STEPS.length, 7);
    const expectedKeywords = [
      /registration and login/i,
      /creating an emergency case/i,
      /selecting required resources/i,
      /selecting an available hospital/i,
      /tracking emergency requests/i,
      /provider request acceptance/i,
      /admin coordination and resource fulfilment/i
    ];
    expectedKeywords.forEach((pattern, index) => {
      const step = CAREBRIDGE_GUIDE_STEPS[index];
      assert.equal(step.stepNumber, index + 1);
      assert.match(step.title, pattern, `Step ${index + 1} title mismatch: ${step.title}`);
      assert.ok(step.summary.length > 20, `Step ${index + 1} summary should provide clear instructions`);
    });
  });

  check('LandingPage.tsx places "How to Use" beside "Contact Us" and contains no hardcoded video URLs', () => {
    const landingPath = path.resolve(
      process.cwd(),
      'src/components/landing/LandingPage.tsx'
    );
    const sourceText = fs.readFileSync(landingPath, 'utf-8');
    const contactIdx = sourceText.indexOf('>Contact Us</a>');
    const howToUseIdx = sourceText.indexOf('<span>How to Use</span>');
    assert.ok(contactIdx > 0, 'Expected Contact Us link in LandingPage.tsx');
    assert.ok(howToUseIdx > contactIdx, 'Expected How to Use nav item immediately after Contact Us');
    assert.ok(!/\.mp4|\.webm|youtube\.com|youtu\.be|vimeo\.com/i.test(sourceText), 'LandingPage.tsx must not hardcode video URLs');
  });

  console.log(`\nGuide Video Verification Suite: ${passed.length} passed.`);
}

runTests();
