import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
};

/* ---- Avatar ---- */
function YUiAvatar({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const [imgOk, setImgOk] = useState(true);
  const sizeClass =
    size === 'lg'
      ? 'w-9 h-9 text-sm ring-2'
      : size === 'md'
        ? 'w-8 h-8 text-sm ring-1'
        : 'w-7 h-7 text-xs ring-1';

  if (!imgOk) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-br from-[#ff6b9d]/40 to-[#ff6b9d]/20 ring-[#ff6b9d]/20 flex items-center justify-center flex-shrink-0`}
      >
        <span className="text-white/80 font-medium">Y</span>
      </div>
    );
  }

  return (
    <img
      src="/images/yui-avatar.png"
      alt="YUi"
      className={`${sizeClass} rounded-full object-cover flex-shrink-0 ring-[#ff6b9d]/20`}
      style={{ objectPosition: '50% 20%' }}
      onError={() => setImgOk(false)}
    />
  );
}

/* ---- Voice hooks ---- */

/** Text-to-Speech: read text aloud in Japanese */
function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled || !window.speechSynthesis) return;
      // Stop any current speech
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = 1.1;
      u.pitch = 1.15;

      // Try to pick a Japanese voice
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(
        v => v.lang.startsWith('ja') && v.name.includes('Female'),
      ) ?? voices.find(v => v.lang.startsWith('ja'));
      if (jaVoice) u.voice = jaVoice;

      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
    },
    [ttsEnabled],
  );

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, ttsEnabled, setTtsEnabled };
}

/**
 * Speech-to-Text: microphone input.
 * @param muted  When true, recognition is paused (e.g. while TTS is speaking)
 *               so the mic doesn't pick up YUi's own voice.
 */
function useMicrophone(
  onResult: (text: string) => void,
  muted: boolean,
) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  const wantListeningRef = useRef(false);
  const mutedRef = useRef(muted);

  // Keep refs fresh
  onResultRef.current = onResult;
  mutedRef.current = muted;

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('このブラウザは音声認識に対応していません。Google Chromeをお使いください。');
      return;
    }

    setError('');

    // Stop any existing recognition
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      // Ignore everything while TTS is speaking
      if (mutedRef.current) return;

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setInterim('');
        onResultRef.current(finalTranscript);
      } else {
        setInterim(interimTranscript);
      }
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't manually stopped
      if (wantListeningRef.current) {
        setTimeout(() => {
          if (wantListeningRef.current) {
            try {
              recognition.start();
            } catch {
              setIsListening(false);
              wantListeningRef.current = false;
            }
          }
        }, 300);
        return;
      }
      setIsListening(false);
      setInterim('');
    };

    recognition.onerror = (e: any) => {
      // Recoverable errors — let onend handle restart
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      // Fatal errors
      wantListeningRef.current = false;
      setIsListening(false);
      setInterim('');
      if (e.error === 'not-allowed') {
        setError('マイクの使用が許可されていません。ブラウザの設定 → サイトの設定 → マイクで許可してください。');
      } else if (e.error === 'network') {
        setError('音声認識サーバーに接続できません。インターネット接続を確認してください。');
      } else {
        setError(`音声認識エラー: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err: any) {
      setError(`開始エラー: ${(err as Error).message}`);
      wantListeningRef.current = false;
    }
  }, []);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setIsListening(false);
    setInterim('');
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clear interim when muted (TTS speaking)
  useEffect(() => {
    if (muted) setInterim('');
  }, [muted]);

  const supported =
    typeof window !== 'undefined' &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );

  return { isListening, toggle, supported, interim, error };
}

/* ---- SVG Icons ---- */

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-4 h-4 ${active ? 'text-[#ff6b9d]' : 'text-white/60'}`}
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M19 10v1a7 7 0 01-14 0v-1" />
      <path d="M12 19v3M8 22h8" />
    </svg>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  if (on) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4 text-white/60"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 010 7.07" />
        <path d="M19.07 4.93a10 10 0 010 14.14" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-white/30"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5 text-white"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

/* ---- Main App ---- */

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [welcomeImgOk, setWelcomeImgOk] = useState(true);
  const isComposingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { speak, stop: stopSpeaking, isSpeaking, ttsEnabled, setTtsEnabled } =
    useSpeech();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Load voices (some browsers load them async)
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    const handler = () => window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', handler);
    return () =>
      window.speechSynthesis?.removeEventListener?.('voiceschanged', handler);
  }, []);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const doSend = async (text: string) => {
    if (!text || isLoading) return;

    // Stop any current speech when user sends a new message
    stopSpeaking();

    const userMsg: Message = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const aiContent = data.response;
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: aiContent },
      ]);
      // Read aloud
      speak(aiContent);
    } catch {
      const errMsg =
        'ごめんね、うまく接続できなかった。サーバーが起動しているか確認してね。\n\npython3 -m uvicorn server:app --port 8000';
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: errMsg },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    doSend(input.trim());
  };

  // Mic: when speech is recognized, auto-send
  const doSendRef = useRef(doSend);
  doSendRef.current = doSend;

  const handleMicResult = useCallback((text: string) => {
    if (!text.trim()) return;
    doSendRef.current(text.trim());
  }, []);

  const mic = useMicrophone(handleMicResult, isSpeaking);

  const hasMessages = messages.length > 0;

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] flex flex-col items-center overflow-hidden relative">
      {/* Background image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/images/yui-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.06,
        }}
      />

      {/* Ambient glow */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#ff6b9d]/[0.04] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-100px] left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#7eb8ff]/[0.03] rounded-full blur-[80px] pointer-events-none" />

      {/* Chat header */}
      {hasMessages && (
        <div className="w-full max-w-2xl px-5 py-3 flex items-center gap-3 border-b border-white/[0.06] flex-shrink-0 animate-fadeIn z-10">
          <YUiAvatar size="lg" />
          <div className="flex-1">
            <p className="text-white/90 text-sm font-medium tracking-wide">
              YUi
            </p>
            <p className="text-[#ff6b9d]/50 text-[11px]">
              {isSpeaking ? 'speaking...' : 'online'}
            </p>
          </div>
          {/* TTS toggle */}
          <button
            onClick={() => {
              if (isSpeaking) stopSpeaking();
              setTtsEnabled(v => !v);
            }}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            title={ttsEnabled ? '読み上げOFF' : '読み上げON'}
          >
            <SpeakerIcon on={ttsEnabled} />
          </button>
        </div>
      )}

      {/* Welcome screen */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fadeIn z-10">
          <div className="relative mb-8 yui-float">
            {welcomeImgOk ? (
              <img
                src="/images/yui-welcome.png"
                alt="YUi"
                className="w-60 h-80 object-contain yui-welcome-img"
                style={{
                  filter: 'drop-shadow(0 0 40px rgba(255,107,157,0.15))',
                }}
                onError={() => setWelcomeImgOk(false)}
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#ff6b9d]/20 to-[#ff6b9d]/5 border border-[#ff6b9d]/10 flex items-center justify-center">
                <span className="text-5xl text-white/60 font-extralight">
                  Y
                </span>
              </div>
            )}
          </div>
          <h1 className="text-4xl font-extralight text-white/90 tracking-[0.25em] mb-3">
            YUiOS
          </h1>
          <p className="text-white/25 text-sm tracking-widest mb-1">
            対話がOSになる
          </p>
        </div>
      )}

      {/* Chat messages */}
      {hasMessages && (
        <div className="flex-1 w-full max-w-2xl overflow-y-auto px-4 pt-4 pb-2 scrollbar-thin z-10">
          <div className="space-y-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex items-end gap-2.5 animate-slideUp ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {msg.role === 'assistant' && <YUiAvatar />}
                <div
                  className={`max-w-[78%] px-4 py-2.5 text-[14px] leading-[1.75] whitespace-pre-wrap ${
                    msg.role === 'assistant'
                      ? 'bg-white/[0.06] text-white/85 rounded-2xl rounded-bl-md border border-white/[0.06] backdrop-blur-sm'
                      : 'bg-[#ff6b9d]/[0.12] text-white/90 rounded-2xl rounded-br-md border border-[#ff6b9d]/[0.12] backdrop-blur-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-end gap-2.5 animate-slideUp">
                <YUiAvatar />
                <div className="bg-white/[0.06] border border-white/[0.06] px-5 py-3.5 rounded-2xl rounded-bl-md backdrop-blur-sm">
                  <div className="flex gap-1.5">
                    <span
                      className="w-1.5 h-1.5 bg-[#ff6b9d]/40 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-[#ff6b9d]/40 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-[#ff6b9d]/40 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} className="h-2" />
        </div>
      )}

      {/* Input area */}
      <div className="w-full max-w-2xl px-4 pb-6 pt-3 flex-shrink-0 z-10">
        {/* Mic error message */}
        {mic.error && (
          <div className="mb-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-fadeIn">
            {mic.error}
          </div>
        )}
        <form onSubmit={sendMessage} className="relative flex items-end gap-2">
          {/* Mic button */}
          {mic.supported && (
            <button
              type="button"
              onClick={mic.toggle}
              disabled={isLoading}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                mic.isListening
                  ? 'bg-[#ff6b9d]/30 border border-[#ff6b9d]/40 mic-pulse'
                  : 'bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08]'
              }`}
              title={mic.isListening ? '停止' : 'マイク'}
            >
              <MicIcon active={mic.isListening} />
            </button>
          )}

          {/* Text input */}
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                adjustHeight();
              }}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={e => {
                isComposingRef.current = false;
                setInput((e.target as HTMLTextAreaElement).value);
              }}
              onKeyDown={e => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !isComposingRef.current
                ) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                isSpeaking && mic.isListening
                  ? '🔇 読み上げ中...終わったら聴くね'
                  : mic.interim
                    ? `🎤 ${mic.interim}`
                    : mic.isListening
                      ? '🎤 聴いてるよ...'
                      : 'YUiに話しかける...'
              }
              rows={1}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-5 py-3 pr-12 text-white/90 text-sm placeholder-white/20 focus:outline-none focus:border-[#ff6b9d]/30 focus:bg-white/[0.07] transition-all duration-200 resize-none scrollbar-thin backdrop-blur-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2.5 bottom-2 w-8 h-8 rounded-xl bg-[#ff6b9d]/70 hover:bg-[#ff6b9d] disabled:bg-white/[0.06] flex items-center justify-center transition-all duration-200"
            >
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
