
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppView, TransmitStatus, Message, AppTheme, UserGender } from './types.ts';
import { generateRoomCode, speakText } from './services/geminiService.ts';
import Waveform from './components/Waveform.tsx';
import { decode, decodeAudioData, createPcmBlob } from './utils/audioUtils.ts';

const THEMES: AppTheme[] = [
  { id: 'stealth', name: 'Modo Oscuro', primary: '#111827', secondary: '#030712', accent: '#22c55e', bg: 'linear-gradient(135deg, #030712 0%, #111827 100%)' },
  { id: 'classic', name: 'Azul Noche', primary: '#4f46e5', secondary: '#312e81', accent: '#818cf8', bg: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' },
  { id: 'desert', name: 'Arena', primary: '#78350f', secondary: '#451a03', accent: '#fbbf24', bg: 'linear-gradient(135deg, #1c1917 0%, #451a03 100%)' },
  { id: 'ironman', name: 'Rojo Energía', primary: '#991b1b', secondary: '#450a0a', accent: '#22d3ee', bg: 'linear-gradient(135deg, #450a0a 0%, #991b1b 100%)' },
  { id: 'neon', name: 'Atardecer Neón', primary: '#be185d', secondary: '#701a75', accent: '#facc15', bg: 'linear-gradient(135deg, #2e1065 0%, #701a75 50%, #be185d 100%)' },
  { id: 'forest', name: 'Bosque Esmeralda', primary: '#065f46', secondary: '#064e3b', accent: '#4ade80', bg: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)' },
  { id: 'purple', name: 'Púrpura Profundo', primary: '#6d28d9', secondary: '#4c1d95', accent: '#f472b6', bg: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)' },
  { id: 'arctic', name: 'Ártico', primary: '#0369a1', secondary: '#0c4a6e', accent: '#7dd3fc', bg: 'linear-gradient(135deg, #082f49 0%, #0c4a6e 100%)' },
  { id: 'matrix', name: 'Cyber Matrix', primary: '#000000', secondary: '#052e16', accent: '#22c55e', bg: 'linear-gradient(135deg, #000000 0%, #052e16 100%)' },
  { id: 'volcano', name: 'Volcán', primary: '#9a3412', secondary: '#7c2d12', accent: '#f97316', bg: 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)' }
];

const MicOnIcon = () => (
  <svg viewBox="0 0 24 24" className="w-14 h-14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" className="w-14 h-14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"></line>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

const ManIcon = () => (
  <svg viewBox="0 0 24 24" className="w-32 h-32 mb-2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="4" />
    <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
  </svg>
);

const WomanIcon = () => (
  <svg viewBox="0 0 24 24" className="w-32 h-32 mb-2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 13V9a5 5 0 0 0-10 0v4" />
    <path d="M7 13c0 2 0 3.5 1 5" />
    <path d="M17 13c0 2 0 3.5-1 5" />
    <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    <path d="M4 21v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1" />
  </svg>
);

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.GENDER_SELECT);
  const [roomCode, setRoomCode] = useState('');
  const [userCallsign, setUserCallsign] = useState('');
  const [status, setStatus] = useState<TransmitStatus>(TransmitStatus.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [autoReadText, setAutoReadText] = useState('');
  const [isTransmittingText, setIsTransmittingText] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTheme, setActiveTheme] = useState<AppTheme>(THEMES[0]);
  const [userGender, setUserGender] = useState<UserGender>('male');

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const localMicNodeRef = useRef<ScriptProcessorNode | null>(null);
  const wakeLockRef = useRef<any>(null);

  const initAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const handleGenderSelect = (gender: UserGender) => {
    setUserGender(gender);
    localStorage.setItem('talkie_gender', gender);
    if (view === AppView.GENDER_SELECT) {
      setView(AppView.CALLSIGN_SETUP);
    }
  };

  const applyTheme = (theme: AppTheme) => {
    setActiveTheme(theme);
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-dark', theme.secondary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--bg-gradient', theme.bg);
    localStorage.setItem('talkie_theme_id', theme.id);
  };

  const safeBroadcast = (type: string, payload: any) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type, payload });
      } catch (err) {
        console.warn("Broadcast Error:", err);
      }
    }
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {}
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => prev.filter(m => Date.now() - m.timestamp < 15000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (roomCode && view === AppView.ROOM) {
      requestWakeLock();
      const channel = new BroadcastChannel(`talkie_room_${roomCode}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = async (event) => {
        const { type, payload } = event.data;
        if (type === 'MESSAGE') {
          setMessages(prev => [payload, ...prev]);
          if (payload.callsign !== userCallsign) {
             speakText(`${payload.callsign} informa: ${payload.text}`, userGender);
          }
        }
        if (type === 'AUDIO_TRANSMISSION') {
          const ctx = await initAudio();
          setStatus(TransmitStatus.RECEIVING);
          const buffer = await decodeAudioData(decode(payload.base64), ctx, 24000, 1);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.onended = () => {
            sourcesRef.current.delete(source);
            if (sourcesRef.current.size === 0) setStatus(TransmitStatus.IDLE);
          };
          source.start(0);
          sourcesRef.current.add(source);
        }
      };
      return () => { 
        channel.close(); 
        broadcastChannelRef.current = null;
        if (wakeLockRef.current) wakeLockRef.current.release();
      };
    }
  }, [roomCode, view, userGender, userCallsign]);

  useEffect(() => {
    const savedGender = localStorage.getItem('talkie_gender');
    const savedCallsign = localStorage.getItem('talkie_callsign');
    const savedThemeId = localStorage.getItem('talkie_theme_id');
    
    if (savedThemeId) {
      const theme = THEMES.find(t => t.id === savedThemeId);
      if (theme) applyTheme(theme);
    } else {
      applyTheme(THEMES[0]);
    }

    if (savedGender && savedCallsign) {
      setUserGender(savedGender as UserGender);
      setUserCallsign(savedCallsign);
      setView(AppView.JOIN);
    }
  }, []);

  const addMessageToLog = useCallback((sender: 'user' | 'system', text: string, callsign?: string) => {
    const newMessage: Message = { 
      id: Math.random().toString(), 
      sender, 
      text, 
      timestamp: Date.now(),
      callsign: callsign || userCallsign
    };
    setMessages(prev => [newMessage, ...prev]);
    safeBroadcast('MESSAGE', newMessage);
  }, [userCallsign]);

  const startTransmission = async () => {
    if (status !== TransmitStatus.IDLE) return;
    try {
      await initAudio(); 
      setStatus(TransmitStatus.TALKING);
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = inputCtx.createMediaStreamSource(stream);
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      localMicNodeRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = createPcmBlob(inputData);
        safeBroadcast('AUDIO_TRANSMISSION', { base64: pcm.data, sender: userCallsign });
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);
    } catch (e) { 
      console.error("Fallo acceso micro:", e);
      setStatus(TransmitStatus.IDLE); 
    }
  };

  const stopTransmission = () => {
    if (status !== TransmitStatus.TALKING) return;
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (localMicNodeRef.current) localMicNodeRef.current.disconnect();
    setStatus(TransmitStatus.IDLE);
  };

  const toggleHandsFree = () => {
    if (isHandsFree) {
      stopTransmission();
      setIsHandsFree(false);
    } else {
      startTransmission();
      setIsHandsFree(true);
    }
  };

  const handleAutoRead = async () => {
    if (!autoReadText.trim()) return;
    setIsTransmittingText(true);
    const text = autoReadText;
    setAutoReadText('');
    addMessageToLog('user', text);
    try {
      setStatus(TransmitStatus.RECEIVING);
      await speakText(`${userCallsign} informa: ${text}`, userGender);
      setStatus(TransmitStatus.IDLE);
    } catch (e) {
      setStatus(TransmitStatus.IDLE);
    } finally {
      setIsTransmittingText(false);
    }
  };

  const SettingsCredits = () => (
    <div className="w-full py-4 text-center space-y-4">
      <div className="flex flex-col items-center gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mono">SISTEMA POR: MC WOLF</p>
        <div className="w-12 h-[1px] bg-white/10"></div>
      </div>
      <div className="flex justify-center items-center gap-4">
        <a href="https://www.facebook.com/share/1aJC2QMujs/" target="_blank" rel="noopener noreferrer" className="p-3 glass rounded-xl border border-white/5 active:scale-90 transition-all">
          <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
        <a href="https://www.instagram.com/mc_roony03?igsh=MW41bmh6ZmpyZXI4bg==" target="_blank" rel="noopener noreferrer" className="p-3 glass rounded-xl border border-white/5 active:scale-90 transition-all">
          <svg className="w-5 h-5 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </a>
      </div>
    </div>
  );

  if (view === AppView.GENDER_SELECT) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 h-full w-full overflow-y-auto">
        <div className="w-full max-w-lg space-y-12">
          <header className="text-center space-y-2">
            <h1 className="text-5xl font-extrabold uppercase tracking-tight title-font">TALKIE<span className="text-[var(--accent)]">-RJ</span></h1>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-[0.2em] mono">Selección de Frecuencia de Voz</p>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <button onClick={() => handleGenderSelect('male')} className="group glass p-10 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 border-white/5 hover:border-[var(--accent)] text-white/40 hover:text-[var(--accent)] aspect-square">
              <div className="transition-transform group-hover:scale-110"><ManIcon /></div>
              <span className="block text-xl font-black uppercase tracking-widest text-white">MASCULINO</span>
            </button>
            <button onClick={() => handleGenderSelect('female')} className="group glass p-10 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 border-white/5 hover:border-[var(--accent)] text-white/40 hover:text-[var(--accent)] aspect-square">
              <div className="transition-transform group-hover:scale-110"><WomanIcon /></div>
              <span className="block text-xl font-black uppercase tracking-widest text-white">FEMENINO</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === AppView.CALLSIGN_SETUP) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 h-full w-full overflow-y-auto">
        <div className="w-full max-w-md space-y-10">
          <header className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold uppercase tracking-tight title-font">ID Operador</h1>
            <p className="text-white/50 text-sm">Ingresa tu identificativo de radio</p>
          </header>
          <div className="glass p-10 rounded-[2.5rem] space-y-8 hud-border">
            <input type="text" value={userCallsign} onChange={(e) => setUserCallsign(e.target.value.toUpperCase())} placeholder="ALPHA-1" className="w-full bg-white/5 border-b-2 border-white/10 p-6 text-center text-3xl font-bold mono text-white focus:border-[var(--accent)] outline-none tracking-widest" />
            <button onClick={() => setView(AppView.JOIN)} disabled={userCallsign.trim().length < 2} className="w-full bg-[var(--accent)] text-black font-extrabold p-5 rounded-xl uppercase tracking-widest text-sm active:scale-95 transition-all shadow-2xl disabled:opacity-20">Registrar ID</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === AppView.JOIN) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 h-full w-full overflow-y-auto">
        <div className="w-full max-w-md space-y-10">
          <header className="text-center space-y-2">
            <h1 className="text-6xl font-extrabold tracking-tight uppercase title-font">TALKIE<span className="text-[var(--accent)]">-RJ</span></h1>
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mono">STATUS: EN LÍNEA | ID: {userCallsign}</p>
          </header>
          <div className="glass p-10 rounded-[2.5rem] space-y-8 hud-border">
            <input type="text" maxLength={6} value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="w-full bg-white/5 border-b-2 border-white/10 p-6 text-center text-4xl font-bold mono text-white focus:border-[var(--accent)] outline-none tracking-[0.4em]" />
            <div className="flex flex-col gap-3">
              <button onClick={() => { if(roomCode.length === 6) setView(AppView.ROOM); speakText(`Operador ${userCallsign} conectado.`, userGender); }} disabled={roomCode.length !== 6} className="w-full bg-[var(--accent)] text-black font-extrabold p-5 rounded-xl uppercase tracking-widest text-sm active:scale-95 transition-all shadow-2xl disabled:opacity-20">Enlazar Canal</button>
              <button onClick={() => setRoomCode(generateRoomCode())} className="w-full glass text-white/50 font-bold p-4 rounded-xl uppercase tracking-widest text-[10px] active:scale-95 transition-all border border-white/5 hover:text-white">Autogenerar Código</button>
            </div>
          </div>
          <button onClick={() => setView(AppView.GENDER_SELECT)} className="text-white/20 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all">Ajustes de Voz</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative">
      <button onClick={() => setShowSettings(!showSettings)} className="absolute top-6 right-6 z-50 p-3 glass rounded-2xl border border-white/10 active:scale-90 transition-all">
        <svg className={`w-6 h-6 ${showSettings ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>

      {showSettings && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl page-enter overflow-y-auto">
          <div className="glass w-full max-w-lg p-8 rounded-[3rem] space-y-8 my-auto relative shadow-2xl">
            <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-white/40 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h2 className="text-2xl font-extrabold uppercase tracking-widest text-center title-font">Configuración Táctica</h2>
            
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mono">Módulo de Voz</p>
              <div className="flex gap-2">
                <button onClick={() => handleGenderSelect('male')} className={`flex-1 p-5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${userGender === 'male' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-white/5 opacity-50 text-white'}`}>
                  <ManIcon />
                  <span className="font-bold uppercase text-[10px] mono">MASCULINO</span>
                </button>
                <button onClick={() => handleGenderSelect('female')} className={`flex-1 p-5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${userGender === 'female' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-white/5 opacity-50 text-white'}`}>
                  <WomanIcon />
                  <span className="font-bold uppercase text-[10px] mono">FEMENINO</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mono">Filtro de Interfaz</p>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => applyTheme(t)} className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${activeTheme.id === t.id ? 'border-[var(--accent)] bg-white/5' : 'border-white/5'}`}>
                    <div className="w-3 h-3 rounded-full" style={{ background: t.accent }}></div>
                    <span className="text-[9px] font-bold uppercase mono">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <SettingsCredits />
              <button onClick={() => setShowSettings(false)} className="w-full bg-[var(--accent)] text-black font-extrabold p-5 rounded-2xl uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all mt-4">Guardar Configuración</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass m-4 p-5 rounded-2xl flex items-center justify-between hud-border shadow-lg">
        <div className="flex items-center gap-5">
          <button onClick={() => setView(AppView.JOIN)} className="p-3 bg-white/5 rounded-xl border border-white/10 active:scale-90 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
          <div>
            <p className="text-[9px] font-bold uppercase text-[var(--accent)] mono">NET_ROOM: {roomCode}</p>
            <p className="text-xl font-bold mono tracking-widest uppercase">{userCallsign}</p>
          </div>
        </div>
        <div className="text-[10px] font-bold text-right mono">
          <p className="text-white/20 uppercase tracking-widest">SISTEMA</p>
          <p className={status === TransmitStatus.IDLE ? 'text-white/40' : (status === TransmitStatus.TALKING ? 'text-red-500 animate-pulse' : 'text-green-500 animate-pulse')}>
            {status === TransmitStatus.IDLE ? 'STANDBY' : (status === TransmitStatus.TALKING ? 'TRANSMITIENDO' : 'RECIBIENDO')}
          </p>
        </div>
      </div>

      <div className="px-6 py-2">
        <div className="glass rounded-[2rem] p-6 flex items-center justify-center h-24 border border-white/5 relative overflow-hidden">
           <Waveform isActive={status !== TransmitStatus.IDLE} color={status === TransmitStatus.TALKING ? '#ef4444' : (status === TransmitStatus.RECEIVING ? '#10b981' : undefined)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col-reverse custom-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[90%] flex flex-col ${m.sender === 'system' ? 'items-start' : 'items-end self-end'} transition-all`}>
            <div className={`p-4 rounded-2xl text-sm font-medium shadow-xl tracking-tight leading-snug ${m.sender === 'system' ? 'glass border-l-2 border-[var(--accent)]' : 'bg-white/5 border border-white/10 text-white'}`}>
               <p className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-40 mono">{m.callsign}</p>
               {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="glass rounded-t-[3.5rem] p-8 pb-14 space-y-6 border-t border-white/10 z-30 shadow-2xl">
        <div className="relative group bg-black/40 rounded-3xl overflow-hidden border border-white/5 shadow-inner">
          <textarea value={autoReadText} onChange={(e) => setAutoReadText(e.target.value)} placeholder="Escribe un anuncio para la sala..." className="w-full bg-transparent p-6 text-sm font-medium text-white outline-none resize-none h-20 placeholder:text-white/10" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAutoRead())} />
          <button onClick={handleAutoRead} disabled={isTransmittingText || !autoReadText.trim()} className={`absolute bottom-4 right-4 p-4 rounded-xl transition-all ${autoReadText.trim() ? 'bg-[var(--accent)] text-black' : 'bg-white/5 text-white/20'}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
          </button>
        </div>
        <div className="flex flex-col items-center gap-6">
          <button onClick={toggleHandsFree} className={`px-8 py-2 rounded-full border text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2 mono ${isHandsFree ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'border-white/10 text-white/20 hover:border-white/30'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isHandsFree ? 'bg-white animate-pulse' : 'bg-white/10'}`}></div>
            {isHandsFree ? 'HANDS-FREE ACTIVE' : 'PUSH-TO-TALK MODE'}
          </button>
          <div className="relative">
            <div className={`absolute inset-[-30px] rounded-full blur-3xl transition-all duration-700 ${status === TransmitStatus.TALKING ? 'bg-red-500/20 scale-110' : (status === TransmitStatus.RECEIVING ? 'bg-emerald-500/20 scale-110' : 'transparent')}`}></div>
            <button 
              onMouseDown={() => !isHandsFree && startTransmission()} 
              onMouseUp={() => !isHandsFree && stopTransmission()}
              onTouchStart={() => !isHandsFree && startTransmission()} 
              onTouchEnd={() => !isHandsFree && stopTransmission()}
              className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl border-[10px] ${
                status === TransmitStatus.TALKING 
                ? 'bg-red-600 border-red-950 scale-95 shadow-red-500/40' 
                : status === TransmitStatus.RECEIVING 
                  ? 'bg-emerald-600 border-emerald-950 shadow-emerald-500/40' 
                  : 'bg-[var(--primary)] border-[var(--primary-dark)] text-[var(--accent)] active:scale-95'
              }`}
            >
              <div className="mb-2">{status === TransmitStatus.TALKING ? <MicOnIcon /> : <MicOffIcon />}</div>
              <span className="text-[8px] font-black uppercase tracking-[0.3em] mono opacity-40">Push</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
