import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Square,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SkipForward,
  RotateCcw,
  Volume1,
} from 'lucide-react';

export function PageSpeakerWidget() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [sentences, setSentences] = useState<string[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');

  const isPlayingRef = useRef(false);
  const sentencesRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const speechRateRef = useRef(1);
  const selectedVoiceUriRef = useRef<string>('');

  // Preload system voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const list = window.speechSynthesis.getVoices();
          if (list && list.length > 0) {
            setAvailableVoices(list);
            if (!selectedVoiceUriRef.current) {
              const preferred =
                list.find((v) => v.lang.toLowerCase().includes('en-ng')) ||
                list.find((v) => v.lang.toLowerCase().includes('en-gb')) ||
                list.find((v) => v.lang.toLowerCase().startsWith('en')) ||
                list[0];
              if (preferred) {
                setSelectedVoiceUri(preferred.voiceURI);
                selectedVoiceUriRef.current = preferred.voiceURI;
              }
            }
          }
        } catch {
          // ignore
        }
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Extract clean text from page content
  const extractPageSentences = (): string[] => {
    const mainEl = document.querySelector('main') || document.querySelector('#root') || document.body;
    if (!mainEl) return ['Welcome to AgriFlow. Smart escrow and agricultural commodity marketplace.'];

    const elements = mainEl.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, p, li, [role="status"], .status-badge'
    );
    const result: string[] = [];

    elements.forEach((el) => {
      if (
        el.offsetParent === null ||
        el.closest('#speech-widget') ||
        el.closest('header') ||
        el.closest('nav') ||
        el.classList.contains('sr-only') ||
        el.getAttribute('aria-hidden') === 'true'
      ) {
        return;
      }

      const text = el.innerText?.trim();
      if (text && text.length > 2) {
        const parts = text.split(/(?<=[.?!])\s+/);
        parts.forEach((p) => {
          const cleaned = p.replace(/\s+/g, ' ').trim();
          if (cleaned.length > 2 && !result.includes(cleaned)) {
            result.push(cleaned);
          }
        });
      }
    });

    return result.length > 0
      ? result
      : [
          'Welcome to AgriFlow platform.',
          'Smart escrow, verified produce listings, and agricultural trade.',
        ];
  };

  const speakSentence = useCallback((index: number) => {
    const list = sentencesRef.current;
    if (index >= list.length || index < 0) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsPaused(false);
      return;
    }

    currentIndexRef.current = index;
    setCurrentSentenceIndex(index);

    const textToSpeak = list[index];

    const onFinish = () => {
      if (isPlayingRef.current) {
        speakSentence(index + 1);
      }
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        setTimeout(() => {
          if (!isPlayingRef.current) return;
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.rate = speechRateRef.current;
          utterance.volume = 1.0;
          utterance.pitch = 1.0;

          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            const matched = voices.find((v) => v.voiceURI === selectedVoiceUriRef.current) || voices[0];
            if (matched) {
              utterance.voice = matched;
              utterance.lang = matched.lang;
            }
          }

          utterance.onend = onFinish;
          utterance.onerror = (e) => {
            console.warn('SpeechSynthesis event:', e);
            onFinish();
          };

          (window as unknown as Record<string, unknown>)._activeUtterance = utterance;
          window.speechSynthesis.speak(utterance);
        }, 30);
      } catch {
        onFinish();
      }
    } else {
      onFinish();
    }
  }, []);

  const handleStart = () => {
    const extracted = extractPageSentences();
    setSentences(extracted);
    sentencesRef.current = extracted;

    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    speechRateRef.current = speechRate;
    selectedVoiceUriRef.current = selectedVoiceUri;

    speakSentence(0);
  };

  const handleTest = () => {
    const sample = [
      'AgriFlow voice reader is active and ready.',
      'Audio output verified successfully on your device.',
    ];
    setSentences(sample);
    sentencesRef.current = sample;

    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    speechRateRef.current = speechRate;
    selectedVoiceUriRef.current = selectedVoiceUri;

    speakSentence(0);
  };

  const handlePause = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      if (!window.speechSynthesis.speaking) {
        speakSentence(currentIndexRef.current);
      }
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsPaused(false);
  };

  const handleNext = () => {
    if (currentIndexRef.current + 1 < sentencesRef.current.length) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      speakSentence(currentIndexRef.current + 1);
    }
  };

  const handleRestart = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    speakSentence(0);
  };

  const currentSentence = sentences[currentSentenceIndex] || '';
  const currentVoiceObj = availableVoices.find((v) => v.voiceURI === selectedVoiceUri) || availableVoices[0];

  return (
    <div
      id="speech-widget"
      className="fixed bottom-20 md:bottom-5 right-5 z-40 flex flex-col items-end gap-2"
    >
      {/* Expanded Control Box */}
      {isExpanded && (
        <div className="bg-gray-900/95 backdrop-blur-md text-white border border-gray-700/80 rounded-2xl shadow-2xl p-4 w-84 space-y-3 animate-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Voice &amp; Screen Reader</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white p-1 rounded cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Voice Selector */}
          {availableVoices.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-semibold text-gray-400">
                Voice ({availableVoices.length} available):
              </label>
              <select
                value={selectedVoiceUri}
                onChange={(e) => {
                  setSelectedVoiceUri(e.target.value);
                  selectedVoiceUriRef.current = e.target.value;
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {availableVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Realtime Live Speech Subtitle */}
          {isPlaying && currentSentence ? (
            <div className="bg-gray-800/90 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-300 leading-relaxed max-h-24 overflow-y-auto shadow-inner">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400 mb-1">
                <span>Reading ({currentSentenceIndex + 1}/{sentences.length || 1})</span>
                <span className="text-emerald-400 font-mono text-[9px] truncate max-w-[120px]">
                  {currentVoiceObj ? currentVoiceObj.name : 'System Voice'}
                </span>
              </div>
              "{currentSentence}"
            </div>
          ) : (
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Listen to the current page read aloud directly through your device speaker or headphones.
            </p>
          )}

          {/* Speed Controls */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-gray-400 text-[10px] uppercase font-semibold">Speed:</span>
            <div className="flex items-center gap-1">
              {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    setSpeechRate(rate);
                    speechRateRef.current = rate;
                    if (isPlaying) {
                      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                      }
                      speakSentence(currentIndexRef.current);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    speechRate === rate
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2 pt-2">
            {!isPlaying ? (
              <>
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                  Read Page Aloud
                </button>
                <button
                  type="button"
                  onClick={handleTest}
                  className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="Test voice audio"
                >
                  <Volume1 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px]">Test</span>
                </button>
              </>
            ) : isPaused ? (
              <>
                <button
                  type="button"
                  onClick={handleResume}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                  title="Next sentence"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="p-2 bg-gray-800 hover:bg-red-600 text-white rounded-xl transition-colors cursor-pointer"
                  title="Stop reading"
                >
                  <Square className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                  title="Next sentence"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                  title="Restart from beginning"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="p-2 bg-gray-800 hover:bg-red-600 text-white rounded-xl transition-colors cursor-pointer"
                  title="Stop reading"
                >
                  <Square className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Pill */}
      <button
        type="button"
        onClick={() => {
          if (!isPlaying && !isExpanded) {
            handleStart();
          }
          setIsExpanded(!isExpanded);
        }}
        className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-xl font-bold text-xs transition-all cursor-pointer ${
          isPlaying
            ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/30 scale-105'
            : 'bg-gray-900 hover:bg-gray-800 text-white border border-gray-700 hover:scale-105'
        }`}
        title="Listen to page content read aloud"
      >
        {isPlaying ? (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-3.5 bg-white rounded-full animate-bounce" />
            <span className="w-1.5 h-5 bg-white rounded-full animate-bounce [animation-delay:0.15s]" />
            <span className="w-1.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:0.3s]" />
          </div>
        ) : (
          <Volume2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        )}

        <span>
          {isPlaying
            ? isPaused
              ? 'Speech Paused'
              : `Reading (${currentSentenceIndex + 1}/${sentences.length || 1})`
            : 'Listen / Read Aloud'}
        </span>

        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
    </div>
  );
}
