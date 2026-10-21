const TRANSCRIPTION = Object.freeze({
  MODEL: 'gemini-3.8-flash',
  ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models',
  API_KEY_PROP: 'GEMINI_API_KEY',
  MAX_BYTES: 15 * 1024 * 1024,
  MAX_STORED_CHARS: 10000,
  RETRYABLE_CODES: [500, 502, 503, 504],
  RETRY_DELAY_MS: 1500,
  UNAVAILABLE_MESSAGE: 'Transcripción automática no disponible. Tu audio se guardará igual; completa la observación si lo necesitas.',
  EXHAUSTED_MESSAGE: 'Transcripción automática agotada. Tu audio se guardará igual; completa la observación si lo necesitas.',
  EXHAUSTED_CODES: [429],
  EXHAUSTED_PATTERN: /quota|exhausted|too many times|rate limit/i,
  BREAKER_KEY: 'TRANSCRIPTION_EXHAUSTED',
  BREAKER_SECONDS: 30 * 60,
  MIME_ALIASES: { 'audio/x-m4a': 'audio/mp4', 'audio/x-wav': 'audio/wav' },
  PROMPT: [
    'Transcribe literalmente este audio en español de Perú.',
    'Contexto: visita de campo de un supervisor a un punto de venta.',
    'Devuelve solo la transcripción, sin comentarios ni formato Markdown.',
    'Si hay varios interlocutores, inicia cada intervención en una línea nueva.',
    'Si el audio no contiene voz inteligible, devuelve exactamente: [SIN VOZ]',
  ].join('\n'),
});

function apiTranscribeAudio(dniJefe, audio) {
  Access.authenticate(dniJefe);
  if (TranscriptionBreaker.isOpen()) return TranscriptionResult.unavailable(true);
  try {
    return TranscriptionResult.ok(Gemini.transcribe(audio));
  } catch (err) {
    console.error(`Transcripción fallida: ${err.message}`);
    const exhausted = TranscriptionBreaker.isExhaustion(err);
    if (exhausted) TranscriptionBreaker.open();
    return TranscriptionResult.unavailable(exhausted);
  }
}

const TranscriptionResult = {
  ok(text) {
    return { available: true, exhausted: false, text, message: '' };
  },
  unavailable(exhausted) {
    return {
      available: false,
      exhausted,
      text: '',
      message: exhausted ? TRANSCRIPTION.EXHAUSTED_MESSAGE : TRANSCRIPTION.UNAVAILABLE_MESSAGE,
    };
  },
};

const TranscriptionBreaker = {
  isOpen() {
    return CacheService.getScriptCache().get(TRANSCRIPTION.BREAKER_KEY) === '1';
  },
  open() {
    CacheService.getScriptCache().put(TRANSCRIPTION.BREAKER_KEY, '1', TRANSCRIPTION.BREAKER_SECONDS);
  },
  reset() {
    CacheService.getScriptCache().remove(TRANSCRIPTION.BREAKER_KEY);
  },
  isExhaustion(err) {
    return TRANSCRIPTION.EXHAUSTED_CODES.includes(err.httpCode) || TRANSCRIPTION.EXHAUSTED_PATTERN.test(err.message);
  },
};

function resetTranscriptionBreaker() {
  TranscriptionBreaker.reset();
}

const Transcript = {
  sanitize(value) {
    const text = String(value || '').trim().slice(0, TRANSCRIPTION.MAX_STORED_CHARS);
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  },
};

const Gemini = {
  transcribe(audio) {
    const data = String((audio && audio.base64) || '');
    if (!data) throw new Error('El audio está vacío.');
    if (data.length * 0.75 > TRANSCRIPTION.MAX_BYTES) throw new Error('El audio supera el límite de transcripción.');

    const response = this.post_(`${TRANSCRIPTION.ENDPOINT}/${TRANSCRIPTION.MODEL}:generateContent`, {
      contents: [{
        parts: [
          { text: TRANSCRIPTION.PROMPT },
          { inline_data: { mime_type: this.mimeType_(audio.mimeType), data } },
        ],
      }],
    });

    const candidate = (response.candidates || [])[0];
    const text = ((candidate && candidate.content && candidate.content.parts) || [])
      .map((p) => p.text || '')
      .join('')
      .trim();
    if (!text) throw new Error(`Respuesta vacía (${(candidate && candidate.finishReason) || 'sin motivo'}).`);
    return text;
  },

  mimeType_(raw) {
    const type = String(raw || '').split(';')[0].trim().toLowerCase();
    return TRANSCRIPTION.MIME_ALIASES[type] || type;
  },

  apiKey_() {
    const key = PropertiesService.getScriptProperties().getProperty(TRANSCRIPTION.API_KEY_PROP);
    if (!key) throw new Error(`Falta la propiedad ${TRANSCRIPTION.API_KEY_PROP}.`);
    return key;
  },

  post_(url, body) {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': this.apiKey_() },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    };
    let res = UrlFetchApp.fetch(url, options);
    if (TRANSCRIPTION.RETRYABLE_CODES.includes(res.getResponseCode())) {
      Utilities.sleep(TRANSCRIPTION.RETRY_DELAY_MS);
      res = UrlFetchApp.fetch(url, options);
    }
    const code = res.getResponseCode();
    if (code !== 200) {
      const error = new Error(`Gemini HTTP ${code}: ${this.errorMessage_(res)}`);
      error.httpCode = code;
      throw error;
    }
    return JSON.parse(res.getContentText());
  },

  errorMessage_(res) {
    try {
      return JSON.parse(res.getContentText()).error.message;
    } catch (_) {
      return res.getContentText().slice(0, 300);
    }
  },
};
