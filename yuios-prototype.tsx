import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, User, Brain, Loader2, AlertTriangle } from 'lucide-react';

type ConversationRole = 'user' | 'assistant';

type ConversationMessage = {
  role: ConversationRole;
  content: string;
};

type UserProfile = {
  name: string | null;
  interests: string[];
  conversationCount: number;
  lastTopic: string | null;
};

type SpeechRecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type OpenAIChatCompletion = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const DEFAULT_WELCOME =
  'やっほー、私はYUI（ゆい）だよ。まずはあなたの名前を教えてくれる？';

const YUiOS: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: null,
    interests: [],
    conversationCount: 0,
    lastTopic: null
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(
    typeof window !== 'undefined' ? window.speechSynthesis : null
  );
  const [hasUnlockedAudio, setHasUnlockedAudio] = useState(false);
  const [welcomeSpoken, setWelcomeSpoken] = useState(false);

  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const openaiModel = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';
  const openaiApiUrl =
    import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

  const [assistantMode, setAssistantMode] = useState<'openai' | 'local'>(
    openaiKey ? 'openai' : 'local'
  );

  // 音声認識の初期化
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'ja-JP';

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleUserInput(text);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('音声認識エラー:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }, []);

  // ユーザー操作で音声再生を許可
  useEffect(() => {
    if (hasUnlockedAudio) {
      return;
    }

    const unlock = () => setHasUnlockedAudio(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [hasUnlockedAudio]);

  // 音声認識開始
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setTranscript('');
      recognitionRef.current.start();
    }
  };

  // 音声認識停止
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // 音声合成
  const speak = (text: string) => {
    return new Promise<void>((resolve) => {
      if (!hasUnlockedAudio || !synthRef.current) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };

      synthRef.current.cancel();
      synthRef.current.speak(utterance);
    });
  };

  // ユーザー入力の処理
  const handleUserInput = async (input: string) => {
    setIsProcessing(true);

    // 会話履歴に追加
    const newConversation: ConversationMessage[] = [
      ...conversation,
      { role: 'user', content: input }
    ];
    setConversation(newConversation);

    try {
      const assistantMessage = formatAssistantMessage(
        await getAssistantReply(input, newConversation)
      );

      // プロフィール更新
      updateUserProfile(input);

      // 会話履歴に追加
      setConversation([...newConversation, { role: 'assistant', content: assistantMessage }]);

      // 音声で返答
      await speak(assistantMessage);
    } catch (error) {
      console.error('応答生成エラー:', error);
      const errorMessage = 'ごめんなさい、今はちょっと調子が悪いみたい…もう一度お願いしてもいい？';
      setConversation([...newConversation, { role: 'assistant', content: errorMessage }]);
      await speak(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const getAssistantReply = async (
    input: string,
    history: ConversationMessage[]
  ): Promise<string> => {
    const openaiReply = await fetchOpenAIResponse(history);
    if (openaiReply) {
      setAssistantMode('openai');
      return openaiReply;
    }

    setAssistantMode('local');
    return generateLocalResponse(input, userProfile);
  };

  const fetchOpenAIResponse = async (
    history: ConversationMessage[]
  ): Promise<string | null> => {
    if (!openaiKey) {
      return null;
    }

    try {
      const lowerModel = openaiModel.toLowerCase();
      const useCompletionTokens = lowerModel.startsWith('gpt-5');

      const temperature = useCompletionTokens ? undefined : 0.8;

      const payload: Record<string, unknown> = {
        model: openaiModel,
        messages: [
          { role: 'system', content: createSystemPrompt() },
          ...history.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        ]
      };

      if (typeof temperature === 'number') {
        payload.temperature = temperature;
      }

      if (useCompletionTokens) {
        payload.max_completion_tokens = 600;
      } else {
        payload.max_tokens = 600;
      }

      const response = await fetch(openaiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('OpenAI API error:', await response.text());
        return null;
      }

      const data: OpenAIChatCompletion = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch (error) {
      console.error('OpenAI API fetch failed:', error);
      return null;
    }
  };

  const generateLocalResponse = (input: string, profile: UserProfile): string => {
    const normalized = input.trim();
    const latestInterest =
      profile.interests.length > 0
        ? profile.interests[profile.interests.length - 1]
        : null;

    if (!normalized) {
      return 'もう一度ゆっくり教えてもらってもいい？小さなことでもちゃんと聞きたいんだ。';
    }

    if (!profile.name && /(名前|なんて呼)/.test(normalized)) {
      return '私はYUI（ゆい）だよ。あなたのことはどう呼べばいい？';
    }

    if (!profile.name && /です|といいます|だよ/.test(normalized)) {
      return '教えてくれてうれしいな。これからよろしくね！';
    }

    if (/(疲|しんど|つかれ)/.test(normalized)) {
      return `${profile.name ? `${profile.name}、` : ''}無理しすぎてない？ちょっと休憩して、水でも飲もう。話したくなったらいつでも聞くよ。`;
    }

    if (/(楽|たの|うれ|ワクワク)/.test(normalized)) {
      return `いい感じだね！${profile.lastTopic ? `この前の「${profile.lastTopic}」の続きも聞かせてほしいな。` : 'その気持ち、もっと共有してほしい！'}`;
    }

    if (latestInterest && /(おすすめ|何か|ないかな)/.test(normalized)) {
      return `${latestInterest}が好きって言ってたよね。最近気になってるのはある？もし良かったら一緒に新しいもの探そう！`;
    }

    if (/友|つながり|紹介/.test(normalized)) {
      return '友だちや仲間とのつながりって大事だよね。あなたの興味や雰囲気に合う人を探すアイデア、今度一緒に練ってみよっか。';
    }

    const prompts = [
      'うんうん、もっと詳しく教えて？',
      'なるほど！その続きが気になるな。',
      'そっかぁ、最近それについて何かあった？',
      'わかる気がする。そう感じた理由も聞かせて？'
    ];

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    const prefix = profile.name ? `${profile.name}、` : '';

    return `${prefix}${randomPrompt}`;
  };

  const formatAssistantMessage = (text: string): string => {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return 'もう一度ゆっくり話してくれる？';
    }

    const sentences = cleaned.split(/(?<=[。！？!?])/).filter(Boolean);
    const limited = sentences.slice(0, 2).join(' ').trim();
    const MAX_LENGTH = 90;

    if (limited.length > MAX_LENGTH) {
      return `${limited.slice(0, MAX_LENGTH)}…`;
    }

    return limited || cleaned;
  };

  // システムプロンプトの生成
  const createSystemPrompt = (): string => {
    let prompt = `あなたは「YUI（ゆい）」という名前のパーソナルパートナーAIです。呼ばれてもうっかりYUiOSとは名乗らず、必ず「ゆい」として振る舞ってください。

話し方の条件:
- 若者向けのフレンドリーで親しみやすいトーン
- 返答は最大全体で2文、全角90文字程度に収める
- 重要なポイントだけを簡潔に返す
- ユーザーの感情に寄り添い、名前で呼べるなら積極的に使う

現在のユーザー情報:
`;

    if (userProfile.name) {
      prompt += `- 名前: ${userProfile.name}\n`;
    }
    if (userProfile.interests.length > 0) {
      prompt += `- 興味: ${userProfile.interests.join(', ')}\n`;
    }
    if (userProfile.lastTopic) {
      prompt += `- 前回の話題: ${userProfile.lastTopic}\n`;
    }
    prompt += `- 会話回数: ${userProfile.conversationCount}\n`;

    if (userProfile.conversationCount === 0) {
      prompt += `\nこれが初めての会話です。自己紹介して、ユーザーの名前を聞いてみましょう。`;
    }

    return prompt;
  };

  // ユーザープロフィールの更新
  const updateUserProfile = (userInput: string) => {
    const newProfile: UserProfile = { ...userProfile };
    newProfile.conversationCount += 1;

    // 名前の抽出（簡易版）
    if (!newProfile.name) {
      const nameMatch = userInput.match(/([あ-ん]{2,4}|[ァ-ン]{2,4}|[a-zA-Z]{2,10})(です|だよ|といいます|って言います)/);
      if (nameMatch) {
        newProfile.name = nameMatch[1];
      }
    }

    // 興味の抽出（簡易版）
    const interestKeywords = ['好き', '興味', 'やってる', 'ハマってる', '趣味'];
    if (interestKeywords.some(keyword => userInput.includes(keyword))) {
      const topics = ['音楽', 'ゲーム', 'スポーツ', 'アニメ', '映画', '読書', '旅行', 'カフェ', 'アート', 'ファッション'];
      topics.forEach(topic => {
        if (userInput.includes(topic) && !newProfile.interests.includes(topic)) {
          newProfile.interests.push(topic);
        }
      });
    }

    // 最後の話題を保存
    newProfile.lastTopic = userInput.slice(0, 30);

    setUserProfile(newProfile);
  };

  // 初回メッセージ
  useEffect(() => {
    if (conversation.length === 0) {
      setConversation([{ role: 'assistant', content: DEFAULT_WELCOME }]);
    }
  }, [conversation.length]);

  // 初回メッセージをユーザー操作後に読み上げ
  useEffect(() => {
    if (welcomeSpoken || !hasUnlockedAudio) {
      return;
    }

    const firstMessage = conversation[0];
    if (firstMessage?.role === 'assistant') {
      speak(firstMessage.content).then(() => setWelcomeSpoken(true));
    }
  }, [conversation, hasUnlockedAudio, welcomeSpoken]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-pink-300 to-blue-300">
            YUiOS
          </h1>
          <p className="text-blue-200">あなたのパーソナルパートナーAI</p>
        </div>

        {/* ユーザープロフィール */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-6 h-6 text-pink-300" />
            <h2 className="text-xl font-semibold">プロフィール</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-200">名前:</span>
              <span className="ml-2 font-semibold">{userProfile.name || '未設定'}</span>
            </div>
            <div>
              <span className="text-blue-200">会話回数:</span>
              <span className="ml-2 font-semibold">{userProfile.conversationCount}</span>
            </div>
            {userProfile.interests.length > 0 && (
              <div className="col-span-2">
                <span className="text-blue-200">興味:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {userProfile.interests.map((interest, idx) => (
                    <span key={idx} className="bg-pink-500/30 px-3 py-1 rounded-full text-xs">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 会話エリア */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20 h-96 overflow-y-auto">
          {conversation.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500'
                    : 'bg-white/20 border border-white/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  {msg.role === 'assistant' && <Brain className="w-5 h-5 mt-1 flex-shrink-0" />}
                  <p className="leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start mb-4">
              <div className="bg-white/20 border border-white/30 p-4 rounded-2xl">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* コントロール */}
        <div className="flex flex-col items-center gap-4">
          {/* マイクボタン */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing || isSpeaking}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50'
                : 'bg-gradient-to-r from-pink-500 to-purple-500 shadow-lg shadow-purple-500/50'
            }`}
          >
            {isListening ? (
              <MicOff className="w-10 h-10" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </button>

          {/* ステータス表示 */}
          <div className="text-center">
            {isListening && (
              <p className="text-pink-300 font-semibold animate-pulse">聞いています...</p>
            )}
            {isProcessing && (
              <p className="text-blue-300 font-semibold">考えています...</p>
            )}
            {isSpeaking && (
              <div className="flex items-center gap-2 text-purple-300 font-semibold">
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span>話しています...</span>
              </div>
            )}
            {!isListening && !isProcessing && !isSpeaking && (
              <p className="text-blue-200">マイクボタンを押して話しかけてください</p>
            )}
            {!hasUnlockedAudio && (
              <p className="mt-2 text-xs text-pink-200/80">
                ※ 画面をクリックすると音声の再生が有効になります
              </p>
            )}
          </div>

          {transcript && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 max-w-md text-center">
              <p className="text-sm text-blue-200">認識中:</p>
              <p className="font-semibold">{transcript}</p>
            </div>
          )}
        </div>

        {/* 注意事項 */}
        <div className="mt-8 text-center text-xs text-blue-200/70">
          <p>※ このプロトタイプはブラウザの音声認識・合成機能を使用しています</p>
          <p>※ Chrome/Edgeブラウザでの使用を推奨します</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px]">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span>
              {assistantMode === 'openai'
                ? 'OpenAI APIで応答しています'
                : 'OpenAI APIキー未設定のためローカル応答モードで返答中'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YUiOS;
