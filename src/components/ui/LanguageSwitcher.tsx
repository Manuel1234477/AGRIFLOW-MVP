import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'en',   label: 'English',    flag: '🇬🇧' },
  { code: 'ha',   label: 'Hausa',      flag: '🇳🇬' },
  { code: 'yo',   label: 'Yorùbá',     flag: '🇳🇬' },
  { code: 'ig',   label: 'Igbo',       flag: '🇳🇬' },
  { code: 'fr',   label: 'Français',   flag: '🇫🇷' },
  { code: 'ar',   label: 'العربية',    flag: '🇸🇦' },
  { code: 'sw',   label: 'Kiswahili',  flag: '🇰🇪' },
  { code: 'pt',   label: 'Português',  flag: '🇵🇹' },
  { code: 'es',   label: 'Español',    flag: '🇪🇸' },
  { code: 'zh-TW',label: '中文',       flag: '🇨🇳' },
  { code: 'hi',   label: 'हिन्दी',     flag: '🇮🇳' },
];

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
}

function getStoredLang(): string {
  const match = document.cookie.match(/googtrans=\/en\/([a-zA-Z-]+)/);
  if (match && match[1]) return match[1];
  return localStorage.getItem('agriflow_lang') || 'en';
}

function setTranslateCookies(code: string) {
  const hostname = window.location.hostname;
  const isEn = !code || code === 'en';

  if (isEn) {
    // Clear all google translate cookies
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname};`;
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${hostname};`;
    document.cookie = 'googtrans=/en/en; path=/;';
    localStorage.setItem('agriflow_lang', 'en');
  } else {
    document.cookie = `googtrans=/en/${code}; path=/;`;
    document.cookie = `googtrans=/en/${code}; path=/; domain=${hostname};`;
    document.cookie = `googtrans=/en/${code}; path=/; domain=.${hostname};`;
    localStorage.setItem('agriflow_lang', code);
  }
}

function triggerTranslate(code: string) {
  const isEn = !code || code === 'en';
  setTranslateCookies(code);

  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (select) {
    if (isEn) {
      select.value = '';
    } else {
      select.value = code;
    }
    select.dispatchEvent(new Event('change'));
  }

  if (isEn) {
    document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
  }
}

export function LanguageSwitcher({ variant = 'dark' }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(getStoredLang());

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    setCurrent(code);
    setOpen(false);
    triggerTranslate(code);
  };

  const currentLang = LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[0];
  const isLight = variant === 'light';

  return (
    <div ref={ref} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          isLight
            ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20 shadow-xs'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-2xs'
        }`}
        title="Switch Language / Canza Harshe"
      >
        <Globe className="w-3.5 h-3.5 opacity-80" />
        <span className="max-w-[85px] truncate flex items-center gap-1">
          <span>{currentLang.flag}</span>
          <span>{currentLang.label}</span>
        </span>
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] bg-white border border-gray-200/90 rounded-xl shadow-xl z-200 min-w-[170px] py-1 max-h-[320px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            Choose Language
          </div>
          {LANGUAGES.map((lang) => {
            const isSelected = current === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`flex items-center justify-between w-full text-left px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-agri-50 text-agri-800 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">{lang.flag}</span>
                  <span>{lang.label}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-agri-700 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
