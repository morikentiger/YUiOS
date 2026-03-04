import { useState, useRef, useEffect, FormEvent } from 'react';

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
};

/* Avatar fallback when image is not loaded */
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

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [welcomeImgOk, setWelcomeImgOk] = useState(true);
  const isComposingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

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
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: data.response },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content:
            'ごめんね、うまく接続できなかった。サーバーが起動しているか確認してね。\n\npython3 -m uvicorn server:app --port 8000',
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

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

      {/* Chat header (shown during conversation) */}
      {hasMessages && (
        <div className="w-full max-w-2xl px-5 py-3 flex items-center gap-3 border-b border-white/[0.06] flex-shrink-0 animate-fadeIn z-10">
          <YUiAvatar size="lg" />
          <div>
            <p className="text-white/90 text-sm font-medium tracking-wide">
              YUi
            </p>
            <p className="text-[#ff6b9d]/50 text-[11px]">online</p>
          </div>
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
        <form onSubmit={sendMessage} className="relative">
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
            placeholder="YUiに話しかける..."
            rows={1}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-5 py-3 pr-12 text-white/90 text-sm placeholder-white/20 focus:outline-none focus:border-[#ff6b9d]/30 focus:bg-white/[0.07] transition-all duration-200 resize-none scrollbar-thin backdrop-blur-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2.5 bottom-2 w-8 h-8 rounded-xl bg-[#ff6b9d]/70 hover:bg-[#ff6b9d] disabled:bg-white/[0.06] flex items-center justify-center transition-all duration-200"
          >
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
          </button>
        </form>
      </div>
    </div>
  );
}
