/**
 * Audio Transcriber - OpenAI Whisper API
 * Downloads voice messages from Meta and transcribes to text
 */

const OpenAI = require('openai');

// IG Business Account ID → Facebook Page ID mapping (for token lookup)
const IG_TO_PAGE = {
  '17841478706257146': '961642687025824',
  '17841478547583918': '755909964271820',
  '17841476737014491': '753892517805817',
  '17841477108011572': '692019233999955',
  '17841474028143993': '683497724836566'
};

// Page token env var mapping
const PAGE_TOKEN_ENVS = {
  '961642687025824': 'META_PAGE_TOKEN_ESPANA',
  '755909964271820': 'META_PAGE_TOKEN_VALENCIA',
  '753892517805817': 'META_PAGE_TOKEN_SEVILLA',
  '692019233999955': 'META_PAGE_TOKEN_BARCELONA',
  '683497724836566': 'META_PAGE_TOKEN_TUNIS'
};

class AudioTranscriber {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Get page access token for a given page/IG ID
   */
  getPageToken(pageId, igId) {
    // Try direct page ID
    if (pageId && PAGE_TOKEN_ENVS[pageId]) {
      const token = process.env[PAGE_TOKEN_ENVS[pageId]];
      if (token) return token;
    }
    // Try IG → FB page mapping
    if (igId) {
      const fbPageId = IG_TO_PAGE[igId];
      if (fbPageId && PAGE_TOKEN_ENVS[fbPageId]) {
        const token = process.env[PAGE_TOKEN_ENVS[fbPageId]];
        if (token) return token;
      }
    }
    // Fallback to default token
    return process.env.META_PAGE_ACCESS_TOKEN || null;
  }

  /**
   * Download audio from Meta's attachment URL
   */
  async downloadAudio(url, pageAccessToken) {
    const { default: fetch } = await import('node-fetch');
    const separator = url.includes('?') ? '&' : '?';
    const audioUrl = `${url}${separator}access_token=${pageAccessToken}`;

    console.log('[TRANSCRIBER] Downloading audio...');
    const response = await fetch(audioUrl, { redirect: 'follow' });

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[TRANSCRIBER] Downloaded ${(buffer.length / 1024).toFixed(1)}KB`);
    return buffer;
  }

  /**
   * Transcribe audio buffer using OpenAI Whisper
   */
  async transcribe(audioBuffer) {
    const file = new File([audioBuffer], 'voice.mp4', { type: 'audio/mp4' });

    console.log('[TRANSCRIBER] Sending to Whisper API...');
    const transcription = await this.openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: file
    });

    const text = transcription.text || '';
    console.log(`[TRANSCRIBER] Transcribed: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
    return text;
  }

  /**
   * Full pipeline: download from Meta URL → transcribe with Whisper
   */
  async transcribeFromUrl(url, message) {
    const pageToken = this.getPageToken(message.pageId, message.igId);
    if (!pageToken) {
      throw new Error('No page access token available for audio download');
    }

    const buffer = await this.downloadAudio(url, pageToken);
    if (buffer.length < 100) {
      throw new Error('Audio file too small or empty');
    }
    if (buffer.length > 25 * 1024 * 1024) {
      throw new Error('Audio file exceeds 25MB limit');
    }

    return await this.transcribe(buffer);
  }
}

module.exports = { AudioTranscriber };
