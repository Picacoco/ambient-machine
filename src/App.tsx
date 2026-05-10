import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dice6, Play, Square, RefreshCcw } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const CHANNELS = 8;
const COLORS = {
  field: "#d4af37",
  drone: "#00ff66",
  mystery: "#ff33cc",
  radio: "#3399ff",
} as const;

type ChannelType = "field" | "drone" | "mystery" | "radio";

interface ChannelState {
  audioUrl: string | null;
  title: string;
  volume: number;
  isLoading: boolean;
  isPlaying: boolean;
  eq: { high: number; mid: number; low: number };
  type: ChannelType;
}

// ─── Audio Utility ───────────────────────────────────────────────────────────
function createSupermassiveImpulse(ctx: AudioContext, duration: number, decay: number) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

// ─── VU Meter Component ──────────────────────────────────────────────────────
function VUMeter({ analyser, isPlaying, compact }: { analyser?: AnalyserNode; isPlaying?: boolean; compact?: boolean }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser || !isPlaying) { setLevel(0); return; }
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setLevel(avg / 128);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isPlaying]);

  const rotation = -45 + level * 90;
  const w = compact ? 80 : 96;
  const h = compact ? 56 : 72;

  return (
    <div
      className="vu-bg relative overflow-hidden rounded-sm"
      style={{
        width: w, height: h,
        border: "2px solid #1a1a1a",
        boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-end">
        <svg viewBox="0 0 100 55" className="w-full" style={{ padding: "2px 6px 0" }}>
          {/* Scale arc */}
          <path d="M12 48 A 38 38 0 0 1 88 48" fill="none" stroke="#8b7355" strokeWidth="0.7" strokeDasharray="1.5 3" />
          {/* Scale marks */}
          <text x="8" y="52" fontSize="5.5" fill="#6b5c3e" fontWeight="700" fontFamily="'JetBrains Mono', monospace">-20</text>
          <text x="43" y="14" fontSize="5.5" fill="#6b5c3e" fontWeight="700" fontFamily="'JetBrains Mono', monospace">0</text>
          <text x="78" y="52" fontSize="5" fill="#c41e3a" fontWeight="800" fontFamily="'JetBrains Mono', monospace">+3</text>
          {/* VU watermark */}
          <text x="50" y="38" fontSize="12" fill="#c4a86b" opacity="0.12" fontWeight="900" textAnchor="middle" fontFamily="'Outfit', sans-serif">VU</text>
        </svg>
        {/* Needle */}
        <div
          className="absolute w-[1.5px] bg-gradient-to-t from-black via-black to-red-700"
          style={{
            bottom: -2, left: "50%",
            height: compact ? 44 : 56,
            transformOrigin: "bottom center",
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            transition: "transform 0.08s ease-out",
          }}
        >
          <div className="absolute top-0 w-[1.5px] h-3 bg-red-600 rounded-t-full" />
        </div>
        {/* Pivot */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#2a2a2a] rounded-full border border-[#444]" style={{ marginBottom: -1 }} />
      </div>
    </div>
  );
}

// ─── Knob Component ──────────────────────────────────────────────────────────
function Knob({ label, value, onChange, onReset, color, size = 36 }: {
  label: string; value: number; onChange: (v: number) => void;
  onReset?: () => void; color: string; size?: number;
}) {
  const rotation = -135 + (value + 12) * (270 / 24);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;
    const onMove = (mv: MouseEvent) => {
      const delta = (startY - mv.clientY) / 2.5;
      onChange(Math.min(12, Math.max(-12, startValue + delta)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="flex flex-col items-center gap-1 cursor-ns-resize select-none"
      onMouseDown={handleMouseDown}
      onDoubleClick={onReset}
    >
      <div
        className="rounded-full knob-body relative"
        style={{ width: size, height: size, border: "2px solid #111" }}
      >
        {/* Indicator notch */}
        <div className="absolute inset-0 flex justify-center pt-[3px]" style={{ transform: `rotate(${rotation}deg)` }}>
          <div className="w-[2.5px] rounded-full" style={{ height: size * 0.25, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
        </div>
        {/* Ring groove */}
        <div className="absolute inset-[3px] rounded-full border border-[#1a1a1a]" />
      </div>
      <span
        className="font-mono text-[7px] font-bold uppercase tracking-wider"
        style={{ color: "#666", fontFamily: "'JetBrains Mono', monospace" }}
      >{label}</span>
    </div>
  );
}

// ─── Tape Deck Animation ─────────────────────────────────────────────────────
function TapeDeck({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Cassette outline */}
      <div className="absolute inset-3 border border-[#222] rounded-md opacity-30" />
      {/* Head bridge */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-1/2 h-6 border-t border-[#222] opacity-30 flex justify-around items-center px-6">
        <div className="w-1 h-1 bg-[#333] rounded-full" />
        <div className="w-1 h-1 bg-[#333] rounded-full" />
      </div>
      {/* Reels */}
      <div className="flex justify-between items-center w-full max-w-[220px] relative z-10">
        {[0, 1].map(i => (
          <div
            key={i}
            className="w-[88px] h-[88px] rounded-full bg-black flex items-center justify-center relative overflow-hidden"
            style={{
              border: "8px solid #111",
              boxShadow: "0 0 20px rgba(0,0,0,0.6), inset 0 0 10px rgba(0,0,0,0.4)",
            }}
          >
            {/* Spokes */}
            <div className={`absolute inset-0 flex items-center justify-center ${isPlaying ? (i === 0 ? 'reel-spin' : 'reel-spin-alt') : ''}`}>
              <div className="w-full h-[1px] bg-[#333] opacity-50" />
              <div className="w-full h-[1px] bg-[#333] opacity-50 absolute rotate-60" />
              <div className="w-full h-[1px] bg-[#333] opacity-50 absolute rotate-[120deg]" />
              <div className="absolute inset-2 border border-[#2a2a2a] rounded-full opacity-40" />
              <div className="absolute inset-5 border border-[#252525] rounded-full opacity-25" />
            </div>
            {/* Hub */}
            <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border-2 border-[#444] z-20 flex items-center justify-center"
              style={{ boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6)" }}>
              <div className="w-2.5 h-2.5 bg-black rotate-45 rounded-sm" />
            </div>
            {/* Shine */}
            <div className="absolute top-1 left-1 w-full h-full bg-gradient-to-br from-white/[0.06] to-transparent pointer-events-none rounded-full" />
          </div>
        ))}
      </div>
      {/* Tape strand */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-[1px] bg-[#1a1a1a] opacity-30" />
    </div>
  );
}

// ─── Channel Strip ───────────────────────────────────────────────────────────
function ChannelStrip({ ch, index, onDice, onVolumeChange, onEQChange }: {
  ch: ChannelState; index: number;
  onDice: () => void;
  onVolumeChange: (v: number) => void;
  onEQChange: (eq: { high: number; mid: number; low: number }) => void;
}) {
  const color = COLORS[ch.type];
  const label = ch.type === "field" ? `FIELD ${index + 1}`
    : ch.type === "drone" ? `DRONE ${index + 1}`
    : ch.type === "mystery" ? "MYSTERY 7"
    : "RADIO 8";

  return (
    <div className="flex-1 min-w-[90px] flex flex-col items-center pt-3 pb-6 gap-3 relative"
      style={{ background: "linear-gradient(180deg, #1c1c1c 0%, #181818 100%)", minHeight: 560 }}>

      {/* Channel label */}
      <div className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color, fontFamily: "'JetBrains Mono', monospace", height: 14, lineHeight: "14px" }}>
        {label}
      </div>

      {/* Title display */}
      <div className="w-full px-2" style={{ height: 22, flexShrink: 0 }}>
        <div className="bg-[#0a0a0a] rounded px-1.5 py-1 text-center border border-[#1a1a1a] relative overflow-hidden h-full flex items-center justify-center"
          style={{ boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)" }}>
          {ch.isLoading && <div className="absolute inset-0 loading-shimmer" />}
          <span className="text-[7px] font-mono block truncate"
            style={{
              color: ch.isLoading ? "#ff6b35" : (ch.audioUrl ? "#00ffcc" : "#333"),
              fontFamily: "'JetBrains Mono', monospace",
            }}>
            {ch.isLoading ? "SEARCHING..." : ch.title}
          </span>
        </div>
      </div>

      {/* EQ Section */}
      <div className="flex flex-col gap-3 py-2 px-2 bg-[#141414] rounded border border-[#1a1a1a]"
        style={{ boxShadow: "inset 0 1px 6px rgba(0,0,0,0.4)" }}>
        <Knob color="#ff4d4d" label="HI" value={ch.eq.high} size={28}
          onChange={(v) => onEQChange({ ...ch.eq, high: v })}
          onReset={() => onEQChange({ ...ch.eq, high: 0 })} />
        <Knob color="#ffaa00" label="MID" value={ch.eq.mid} size={28}
          onChange={(v) => onEQChange({ ...ch.eq, mid: v })}
          onReset={() => onEQChange({ ...ch.eq, mid: 0 })} />
        <Knob color="#3399ff" label="LO" value={ch.eq.low} size={28}
          onChange={(v) => onEQChange({ ...ch.eq, low: v })}
          onReset={() => onEQChange({ ...ch.eq, low: 0 })} />
      </div>

      {/* Dice button */}
      <button
        onClick={onDice}
        className="p-2 rounded-full btn-hardware relative"
        style={{
          background: ch.isLoading ? "#b45309" : "#1a1a1a",
          border: "2px solid #333",
          color,
        }}
      >
        <Dice6 size={16} className={ch.isLoading ? "animate-spin" : ""} />
        {ch.isPlaying && ch.audioUrl && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full led-glow" style={{ backgroundColor: color, color }} />
        )}
      </button>

      {/* Fader */}
      <div className="flex-1 flex flex-col items-center justify-end w-full px-3 pt-2 relative">
        <div className="h-56 w-10 bg-[#0a0a0a] rounded-sm relative flex items-center justify-center fader-slot"
          style={{ border: "2px solid #1a1a1a" }}>
          {/* Scale marks */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 px-1 pointer-events-none">
            {[10, 8, 6, 4, 2, 0].map(n => (
              <div key={n} className="flex items-center gap-0.5">
                <div className="w-full h-[1px] bg-white opacity-10" />
              </div>
            ))}
          </div>
          {/* Hidden range input */}
          <input
            type="range" min="0" max="1" step="0.005" value={ch.volume}
            onInput={(e) => onVolumeChange(parseFloat(e.currentTarget.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
            style={{ WebkitAppearance: "slider-vertical" } as React.CSSProperties}
          />
          {/* Fader cap */}
          <div
            className="absolute w-9 h-12 pointer-events-none z-20 flex flex-col justify-center gap-[3px] rounded"
            style={{
              bottom: `${ch.volume * 170}px`,
              background: "linear-gradient(180deg, #444 0%, #2a2a2a 50%, #222 100%)",
              border: "1.5px solid #555",
              boxShadow: "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="w-full h-[2.5px] bg-orange-600 rounded-full" />
            <div className="w-full h-[1px] bg-[#555]" />
            <div className="w-full h-[1px] bg-[#555]" />
          </div>
          {/* Level indicator glow */}
          {ch.isPlaying && ch.volume > 0 && (
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10 rounded-b-sm"
              style={{
                height: `${ch.volume * 100}%`,
                background: `linear-gradient(to top, ${color}08, transparent)`,
              }}
            />
          )}
        </div>
        <span className="text-[9px] mt-2 font-bold" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
          {index + 1}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AmbientMachine() {
  const [channels, setChannels] = useState<ChannelState[]>(
    Array(CHANNELS).fill(null).map((_, i) => ({
      audioUrl: null,
      title: "EMPTY",
      volume: 0.0,
      isLoading: false,
      isPlaying: false,
      eq: { high: 0, mid: 0, low: 0 },
      type: (i < 4 ? "field" : i < 6 ? "drone" : i === 6 ? "mystery" : "radio") as ChannelType,
    }))
  );

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [fadeTime, setFadeTime] = useState(1.5);
  const [tapeEffects, setTapeEffects] = useState({ reverb: 0, wow: 0, flutter: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const sessionLogsRef = useRef<{ time: string; action: string }[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const wowDepthRef = useRef<GainNode | null>(null);
  const flutterDepthRef = useRef<GainNode | null>(null);
  const effectsNodesRef = useRef<any>(null);
  const channelNodesRef = useRef<{
    source: MediaElementAudioSourceNode; gain: GainNode;
    eqLow: BiquadFilterNode; eqMid: BiquadFilterNode; eqHigh: BiquadFilterNode;
    analyser: AnalyserNode;
  }[]>([]);
  const audioElementsRef = useRef<(HTMLAudioElement | null)[]>([]);

  // ─── Init Audio Engine ──────────────────────────────────────────────
  useEffect(() => {
    const ctx = new AudioContext();
    const mg = ctx.createGain();
    mg.gain.value = masterVolume;

    const masterAnalyser = ctx.createAnalyser();
    masterAnalyser.fftSize = 256;
    masterAnalyserRef.current = masterAnalyser;

    // Reverb
    const reverbNode = ctx.createConvolver();
    reverbNode.buffer = createSupermassiveImpulse(ctx, 12, 10);
    const reverbGain = ctx.createGain();
    const dryGain = ctx.createGain();
    reverbGain.gain.value = 0;
    dryGain.gain.value = 1;

    // Wow - slow pitch warble (Chase Bliss Generation Loss style)
    const wowDelay = ctx.createDelay(1);
    wowDelay.delayTime.value = 0.03;
    const wowLFO = ctx.createOscillator();
    const wowDepth = ctx.createGain();
    wowLFO.frequency.value = 0.5;
    wowDepth.gain.value = 0;
    wowLFO.connect(wowDepth);
    wowDepth.connect(wowDelay.delayTime);
    wowLFO.start();

    // Flutter
    const flutterDelay = ctx.createDelay();
    flutterDelay.delayTime.value = 0.01;
    const flutterLFO = ctx.createOscillator();
    const flutterDepth = ctx.createGain();
    flutterLFO.frequency.value = 12.0;
    flutterDepth.gain.value = 0;
    flutterLFO.connect(flutterDepth);
    flutterDepth.connect(flutterDelay.delayTime);
    flutterLFO.start();

    // Routing
    const effectsInput = ctx.createGain();
    effectsInput.connect(dryGain);
    effectsInput.connect(reverbNode);
    reverbNode.connect(reverbGain);
    dryGain.connect(wowDelay);
    reverbGain.connect(wowDelay);
    wowDelay.connect(flutterDelay);
    flutterDelay.connect(mg);
    mg.connect(masterAnalyser);
    masterAnalyser.connect(ctx.destination);

    audioContextRef.current = ctx;
    masterGainRef.current = mg;
    wowDepthRef.current = wowDepth;
    flutterDepthRef.current = flutterDepth;
    effectsNodesRef.current = { reverbNode, reverbGain, dryGain, wowDelay, flutterDelay, wowLFO, flutterLFO, input: effectsInput };

    return () => { ctx.close(); };
  }, []);

  // ─── Master Effects ──────────────────────────────────────────────────
  const updateMasterEffects = useCallback((updates: Partial<typeof tapeEffects>) => {
    setTapeEffects(prev => {
      const next = { ...prev, ...updates };
      const nodes = effectsNodesRef.current;
      const ctx = audioContextRef.current;
      if (nodes && ctx) {
        const t = ctx.currentTime;
        if (updates.reverb !== undefined) {
          nodes.reverbGain.gain.setTargetAtTime(updates.reverb, t, 0.1);
          nodes.dryGain.gain.setTargetAtTime(1 - updates.reverb * 0.5, t, 0.1);
        }
        if (updates.wow !== undefined && wowDepthRef.current)
          wowDepthRef.current.gain.setTargetAtTime(updates.wow * 0.025, t, 0.1);
        if (updates.flutter !== undefined && flutterDepthRef.current)
          flutterDepthRef.current.gain.setTargetAtTime(updates.flutter * 0.003, t, 0.1);
      }
      return next;
    });
  }, []);

  // ─── Channel Management ─────────────────────────────────────────────
  const updateChannel = useCallback((index: number, updates: Partial<ChannelState>, instant = true) => {
    setChannels(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      const nodes = channelNodesRef.current[index];
      if (nodes && audioContextRef.current) {
        const t = audioContextRef.current.currentTime;
        if (updates.volume !== undefined && instant)
          nodes.gain.gain.setTargetAtTime(updates.volume, t, 0.01);
        if (updates.eq) {
          nodes.eqLow.gain.setTargetAtTime(updates.eq.low, t, 0.02);
          nodes.eqMid.gain.setTargetAtTime(updates.eq.mid, t, 0.02);
          nodes.eqHigh.gain.setTargetAtTime(updates.eq.high, t, 0.02);
        }
      }
      return next;
    });
  }, []);

  const setupAudioNodes = useCallback((index: number, element: HTMLAudioElement) => {
    const ctx = audioContextRef.current;
    const effects = effectsNodesRef.current;
    if (!ctx || !effects) return;
    if (channelNodesRef.current[index]?.source.mediaElement === element) return;

    // Disconnect old nodes if they exist
    const oldNodes = channelNodesRef.current[index];
    if (oldNodes) {
      try {
        oldNodes.analyser.disconnect();
        oldNodes.gain.disconnect();
        oldNodes.eqHigh.disconnect();
        oldNodes.eqMid.disconnect();
        oldNodes.eqLow.disconnect();
        oldNodes.source.disconnect();
      } catch (e) { /* already disconnected */ }
    }

    const source = ctx.createMediaElementSource(element);
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    const eqLow = ctx.createBiquadFilter();
    eqLow.type = "lowshelf"; eqLow.frequency.value = 250;
    const eqMid = ctx.createBiquadFilter();
    eqMid.type = "peaking"; eqMid.frequency.value = 1000;
    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = "highshelf"; eqHigh.frequency.value = 4000;

    source.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(gain);
    gain.connect(analyser);
    analyser.connect(effects.input);

    channelNodesRef.current[index] = { source, gain, eqLow, eqMid, eqHigh, analyser };
    gain.gain.value = 0;
    element.play().catch(() => {});
  }, []);

  // ─── Animated Fader Fade-Out ──────────────────────────────────────
  const animateFadeOut = useCallback((index: number, duration: number): Promise<void> => {
    return new Promise((resolve) => {
      const startVolume = channels[index].volume;
      if (startVolume <= 0) { resolve(); return; }
      const nodes = channelNodesRef.current[index];
      const ctx = audioContextRef.current;
      if (!nodes || !ctx) { resolve(); return; }

      // Schedule the audio gain fade
      const now = ctx.currentTime;
      nodes.gain.gain.cancelScheduledValues(now);
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now);
      nodes.gain.gain.linearRampToValueAtTime(0, now + duration);
      nodes.eqLow.gain.setTargetAtTime(0, now, duration / 3);
      nodes.eqMid.gain.setTargetAtTime(0, now, duration / 3);
      nodes.eqHigh.gain.setTargetAtTime(0, now, duration / 3);

      // Animate the UI fader position
      const startTime = performance.now();
      const durationMs = duration * 1000;
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const currentVolume = startVolume * (1 - progress);

        setChannels(prev => {
          const next = [...prev];
          next[index] = { ...next[index], volume: currentVolume };
          return next;
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setChannels(prev => {
            const next = [...prev];
            next[index] = { ...next[index], volume: 0, eq: { high: 0, mid: 0, low: 0 } };
            return next;
          });
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }, [channels]);

  // ─── Fade Out All Channels ──────────────────────────────────────────
  const fadeOutAllChannels = useCallback((): Promise<void> => {
    const activeChannels = channels
      .map((ch, i) => ({ ch, i }))
      .filter(({ ch }) => ch.isPlaying && ch.volume > 0);

    if (activeChannels.length === 0) return Promise.resolve();

    return Promise.all(
      activeChannels.map(({ i }) => animateFadeOut(i, fadeTime))
    ).then(() => {});
  }, [channels, fadeTime, animateFadeOut]);

  // ─── Fetch Random Recording ─────────────────────────────────────────
  const fetchRandomRecording = useCallback(async (index: number) => {
    if (audioContextRef.current?.state === "suspended") audioContextRef.current.resume();

    const type = channels[index].type;

    // Animated fade out of the current track
    const hasCurrent = channels[index].isPlaying && channels[index].volume > 0;
    if (hasCurrent) {
      setChannels(prev => {
        const next = [...prev];
        next[index] = { ...next[index], title: "FADING OUT..." };
        return next;
      });
      await animateFadeOut(index, fadeTime);
    }

    setChannels(prev => {
      const next = [...prev];
      next[index] = { ...next[index], isLoading: true, title: "SEARCHING...", volume: 0, eq: { high: 0, mid: 0, low: 0 } };
      return next;
    });

    const fetchPromise = (async () => {
      let searchQuery = "";
      if (type === "field")
        searchQuery = '(subject:"field recording" OR subject:"soundscape" OR subject:"found sound" OR subject:"musique concrete" OR subject:"acoustic ecology" OR subject:"nature sounds" OR subject:"urban sounds" OR subject:"underwater recording" OR subject:"bioacoustics" OR subject:"dawn chorus" OR subject:"rain recording" OR subject:"thunder" OR subject:"wind recording" OR subject:"ocean waves" OR subject:"forest sounds" OR subject:"industrial sounds" OR subject:"city ambience" OR subject:"train sounds" OR subject:"market sounds") AND mediatype:audio AND -subject:podcast AND -subject:radio AND -subject:talk AND -subject:music AND -subject:song AND -subject:lecture AND -subject:broadcast AND -subject:"radio program" AND -title:radio AND -title:broadcast';
      else if (type === "drone")
        searchQuery = '(subject:"drone music" OR subject:"ambient drone" OR subject:"modular synth" OR subject:"harmonium" OR subject:"pipe organ" OR subject:"resonance" OR subject:"room tone" OR subject:"singing bowl" OR subject:"overtone" OR subject:"tanpura" OR subject:"didgeridoo" OR subject:"shruti box" OR subject:"tape loop" OR subject:"feedback" OR subject:"noise music" OR subject:"dark ambient" OR subject:"deep listening" OR subject:"meditation drone" OR subject:"sustained tones" OR subject:"spectral music") AND mediatype:audio AND -subject:podcast AND -subject:radio AND -subject:interview AND -subject:host AND -subject:vocals AND -subject:"spoken word" AND -subject:lecture';
      else if (type === "mystery")
        searchQuery = '(subject:"shortwave radio" OR subject:"satellite transmissions" OR subject:"numbers station" OR subject:"space sound" OR subject:"telemetry" OR subject:"vlf recording" OR subject:"electromagnetic recording" OR subject:"EVP" OR subject:"radio interference" OR subject:"morse code" OR subject:"sonar" OR subject:"hydrophone" OR subject:"seismograph sonification" OR subject:"aurora sounds" OR subject:"jupiter recording" OR subject:"magnetosphere" OR subject:"ionosphere" OR subject:"cosmic noise" OR subject:"static noise") AND mediatype:audio AND -subject:podcast AND -subject:talk AND -subject:documentary AND -subject:explanation';
      else
        searchQuery = '(subject:"am radio" OR subject:"radio broadcast" OR subject:"old time radio" OR subject:"cb radio" OR subject:"scanner" OR subject:"radio static" OR subject:"radio tuning" OR subject:"pirate radio" OR subject:"emergency broadcast" OR subject:"weather radio" OR subject:"aviation radio" OR subject:"ham radio" OR subject:"medium wave" OR subject:"longwave radio" OR subject:"radio noise" OR subject:"broadcast test" OR subject:"station identification") AND mediatype:audio AND -subject:comedy AND -subject:drama AND -subject:news AND -subject:story AND -subject:episode AND -subject:music AND -subject:song AND -subject:concert AND -subject:"music program" AND -subject:dj';

      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQuery)}&fl[]=identifier,title&rows=150&page=${Math.floor(Math.random() * 40) + 1}&output=json`;
      const response = await fetch(searchUrl);
      const data = await response.json();
      const docs = data.response?.docs;
      if (!docs || docs.length === 0) throw new Error("No docs");

      for (let attempt = 0; attempt < 5; attempt++) {
        const randomDoc = docs[Math.floor(Math.random() * docs.length)];
        const itemResponse = await fetch(`https://archive.org/metadata/${randomDoc.identifier}`);
        const itemData = await itemResponse.json();
        const audioFiles = (itemData.files || []).filter((f: any) =>
          (f.format === "VBR MP3" || f.format === "MP3" || f.name?.toLowerCase().endsWith(".mp3"))
          && parseFloat(f.size || "0") > 500000
        );
        const audioFile = audioFiles.length > 0
          ? audioFiles.reduce((best: any, f: any) => parseFloat(f.size || "0") > parseFloat(best.size || "0") ? f : best)
          : null;
        if (audioFile) {
          return {
            url: `https://archive.org/download/${randomDoc.identifier}/${audioFile.name}`,
            title: (randomDoc.title || audioFile.name).toUpperCase().substring(0, 30),
            id: randomDoc.identifier,
          };
        }
      }
      throw new Error("No MP3 after retries");
    })();

    try {
      const result = await fetchPromise;

      if (isRecording) {
        const timestamp = formatTime(recordingTime);
        sessionLogsRef.current.push({
          time: timestamp,
          action: `Loaded ${type.toUpperCase()} on T${index + 1}: ${result.title} (https://archive.org/details/${result.id})`,
        });
      }

      setChannels(prev => {
        const next = [...prev];
        next[index] = { ...next[index], audioUrl: result.url, title: result.title, isLoading: false, isPlaying: true, volume: 0.0 };
        return next;
      });
    } catch (error) {
      console.error("Archive Error:", error);
      setChannels(prev => {
        const next = [...prev];
        next[index] = { ...next[index], isLoading: false, title: "EMPTY", audioUrl: null };
        return next;
      });
    }
  }, [channels, fadeTime, isRecording, recordingTime, animateFadeOut]);

  // ─── Transport Controls ─────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      sessionLogsRef.current.push({ time: formatTime(recordingTime), action: "Recording Stopped" });
      recorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  }, [recordingTime]);

  const playAll = useCallback(() => {
    if (audioContextRef.current?.state === "suspended") audioContextRef.current.resume();
    channels.forEach((ch, i) => {
      const audio = audioElementsRef.current[i];
      if (audio && !ch.isPlaying && ch.audioUrl) {
        audio.play().catch(() => {});
        updateChannel(i, { isPlaying: true });
      }
    });
  }, [channels, updateChannel]);

  const stopAll = useCallback(async () => {
    // Fade out all channels with animated faders, then pause
    await fadeOutAllChannels();
    channels.forEach((ch, i) => {
      const audio = audioElementsRef.current[i];
      if (audio && ch.isPlaying) {
        audio.pause();
      }
    });
    setChannels(prev => prev.map(ch => ({ ...ch, isPlaying: false, volume: 0 })));
    if (isRecording) stopRecording();
  }, [channels, isRecording, fadeOutAllChannels, stopRecording]);

  const startRecording = useCallback(() => {
    if (!audioContextRef.current || isRecording) return;
    audioContextRef.current.resume();

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const dest = audioContextRef.current.createMediaStreamDestination();
    masterGainRef.current?.connect(dest);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const recorder = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 256000 });

    recorderRef.current = recorder;
    chunksRef.current = [];

    const initialLogs = [{ time: "00:00", action: "Recording Started" }];
    channels.forEach((ch, i) => {
      if (ch.audioUrl) {
        initialLogs.push({
          time: "00:00",
          action: `Active on T${i + 1} at Start: ${ch.title} (https://archive.org/details/${ch.audioUrl.split("/")[4]})`,
        });
      }
    });
    sessionLogsRef.current = initialLogs;

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ambient-session-${timestamp}.webm`;
      a.click();

      const logText = "AMBIENT STUDIO SESSION LOG\n========================\n\n" +
        sessionLogsRef.current.map(l => `[${l.time}] ${l.action}`).join("\n");
      const logBlob = new Blob([logText], { type: "text/plain" });
      const logUrl = URL.createObjectURL(logBlob);
      const logA = document.createElement("a");
      logA.href = logUrl;
      logA.download = `ambient-session-credits-${timestamp}.txt`;
      logA.click();
    };

    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    timerIntervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
  }, [isRecording, channels]);

  const anyPlaying = channels.some(c => c.isPlaying);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-2 xl:p-6" style={{ background: "radial-gradient(ellipse at center, #111 0%, #080808 70%)" }}>
      {/* Noise texture */}
      <div className="fixed inset-0 noise-overlay" />

      {/* Console Body */}
      <div className="relative bg-[#1a1a1a] rounded-lg console-shadow overflow-hidden w-full max-w-[1600px]"
        style={{
          border: "3px solid #2a2a2a",
          borderTop: "4px solid #3a3a3a",
          borderBottom: "5px solid #0a0a0a",
        }}>

        {/* Top edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* ─── VU Meter Bar ─────────────────────────────────────────── */}
        <div className="h-32 flex items-center justify-between px-3 relative"
          style={{
            background: "linear-gradient(180deg, #1e1e1e 0%, #181818 100%)",
            borderBottom: "6px solid #0a0a0a",
          }}>
          {/* Brand */}
          <div className="absolute top-2 left-4">
            <span className="text-[9px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
              AMBIENT MACHINE
            </span>
          </div>

          {/* Channel VU meters */}
          <div className="flex flex-1 justify-around pt-4 pr-4">
            {channels.map((ch, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <VUMeter analyser={channelNodesRef.current[i]?.analyser} isPlaying={ch.isPlaying} compact />
                <span className="text-[7px] font-bold tracking-[0.15em]"
                  style={{ color: COLORS[ch.type], fontFamily: "'JetBrains Mono', monospace" }}>
                  T{i + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Master VU */}
          <div className="flex gap-1.5 pl-3" style={{ borderLeft: "2px solid #1a1a1a" }}>
            <div className="flex flex-col items-center gap-1 pt-4">
              <VUMeter analyser={masterAnalyserRef.current || undefined} isPlaying={anyPlaying} />
              <span className="text-[6px] font-bold tracking-[0.2em]"
                style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>L</span>
            </div>
            <div className="flex flex-col items-center gap-1 pt-4">
              <VUMeter analyser={masterAnalyserRef.current || undefined} isPlaying={anyPlaying} />
              <span className="text-[6px] font-bold tracking-[0.2em]"
                style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>R</span>
            </div>
          </div>
        </div>

        {/* ─── Main Body ───────────────────────────────────────────── */}
        <div className="flex min-h-[560px]" style={{ background: "#1c1c1c" }}>

          {/* Channel Strips */}
          <div className="flex flex-[3] overflow-hidden" style={{ borderRight: "6px solid #0a0a0a" }}>
            {channels.map((ch, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="w-[3px] bg-[#0a0a0a]" />}
                <ChannelStrip
                  ch={ch} index={i}
                  onDice={() => fetchRandomRecording(i)}
                  onVolumeChange={(v) => {
                    if (audioContextRef.current?.state === "suspended") audioContextRef.current.resume();
                    updateChannel(i, { volume: v });
                  }}
                  onEQChange={(eq) => updateChannel(i, { eq })}
                />
                {/* Hidden audio elements */}
                {ch.audioUrl && (
                  <audio
                    key={ch.audioUrl}
                    ref={(el) => { audioElementsRef.current[i] = el; if (el) setupAudioNodes(i, el); }}
                    src={ch.audioUrl}
                    loop
                    crossOrigin="anonymous"
                    className="hidden"
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ─── Right Panel: Tape Deck & Master ─────────────────── */}
          <div className="w-[300px] flex flex-col" style={{ background: "linear-gradient(180deg, #1a1a1a 0%, #161616 100%)" }}>

            {/* Tape Deck */}
            <div className="p-4" style={{ borderBottom: "6px solid #0a0a0a" }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold tracking-[0.08em]"
                  style={{ color: "#ff6b35", fontFamily: "'Outfit', sans-serif" }}>
                  AMBIENT STUDIO
                </span>
                <div className="flex items-center gap-2">
                  {isRecording && (
                    <span className="text-[8px] font-bold rec-blink"
                      style={{ color: "#e11d48", fontFamily: "'JetBrains Mono', monospace" }}>
                      ● REC
                    </span>
                  )}
                  <div className="w-5 h-5 rounded-sm flex items-center justify-center"
                    style={{ background: "#c41e3a", border: "1px solid #8b1525", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.15)" }}>
                    <div className={`w-1.5 h-1.5 bg-red-300 rounded-full ${anyPlaying ? "rec-blink" : ""}`} />
                  </div>
                </div>
              </div>

              <div className="tape-window h-40 rounded-lg p-3 relative overflow-hidden"
                style={{ border: "3px solid #1a1a1a" }}>
                <div className="absolute inset-0 scanlines" />
                <TapeDeck isPlaying={anyPlaying} />
              </div>
            </div>

            {/* Info Display & Controls */}
            <div className="flex-1 p-4 flex flex-col justify-between">

              {/* Track Info Screen */}
              <div className="bg-[#070707] rounded p-2.5 relative overflow-hidden"
                style={{
                  border: "2px solid #1a1a1a",
                  boxShadow: "inset 0 1px 8px rgba(0,0,0,0.5)",
                  minHeight: 90,
                }}>
                <div className="absolute inset-0 scanlines opacity-40" />
                <div className="relative z-10" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {channels.some(c => c.isLoading) ? (
                    <span className="text-[9px] text-orange-500 rec-blink block">
                      {" >> SEARCHING ARCHIVE..."}
                    </span>
                  ) : (
                    <div className="space-y-[2px]">
                      {channels.map((ch, idx) => ch.audioUrl ? (
                        <div key={idx} className="flex gap-1.5 text-[8px] whitespace-nowrap overflow-hidden fade-up"
                          style={{ animationDelay: `${idx * 30}ms` }}>
                          <span style={{ color: COLORS[ch.type], opacity: 0.6 }}>T{idx + 1}:</span>
                          <span className="truncate" style={{ color: "#00ffcc" }}>{ch.title}</span>
                        </div>
                      ) : null)}
                      {!channels.some(c => c.audioUrl) && (
                        <span className="text-[9px] tracking-[0.25em]" style={{ color: "#222" }}>SYSTEM READY</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Transport + Master */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="col-span-2 space-y-3">
                  {/* Transport buttons */}
                  <div className="flex gap-2">
                    <button onClick={playAll}
                      className="flex-1 h-11 bg-[#1e1e1e] btn-hardware flex items-center justify-center text-[#666] hover:text-green-500 rounded"
                      style={{ border: "1.5px solid #333" }}>
                      <Play size={18} />
                    </button>
                    <button onClick={startRecording} disabled={isRecording}
                      className={`flex-1 h-11 btn-hardware flex items-center justify-center gap-1.5 rounded ${isRecording ? "text-red-400" : "text-red-600 hover:text-red-400"}`}
                      style={{ background: isRecording ? "#4a1520" : "#1e1e1e", border: "1.5px solid #333" }}>
                      <div className={`w-2.5 h-2.5 bg-red-600 rounded-full ${isRecording ? "rec-blink" : ""}`} />
                      <span className="text-[10px] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>REC</span>
                    </button>
                    <button onClick={stopAll}
                      className="flex-1 h-11 bg-[#1e1e1e] btn-hardware flex items-center justify-center text-[#888] hover:text-red-500 rounded"
                      style={{ border: "1.5px solid #333" }}>
                      <Square size={16} />
                    </button>
                  </div>

                  {/* Timer */}
                  <div className="flex justify-between items-center bg-[#0a0a0a] px-3 py-2 rounded"
                    style={{ border: "1.5px solid #1a1a1a", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)" }}>
                    <span className="text-lg tracking-[0.15em]"
                      style={{ color: "#ff6b35", fontFamily: "'JetBrains Mono', monospace", textShadow: "0 0 8px rgba(255,107,53,0.3)" }}>
                      {isRecording ? formatTime(recordingTime) : "00:00"}
                    </span>
                    <button onClick={() => { if (!isRecording) setRecordingTime(0); }}
                      className="text-[#444] hover:text-white transition-colors">
                      <RefreshCcw size={13} />
                    </button>
                  </div>
                </div>

                {/* Effects + Master knobs */}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex flex-col gap-2 bg-[#141414] p-2 rounded border border-[#1a1a1a]"
                    style={{ boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)" }}>
                    <div className="flex gap-1.5">
                      <Knob size={26} label="RVB" color="#ff4d4d"
                        value={tapeEffects.reverb * 24 - 12}
                        onChange={(v) => updateMasterEffects({ reverb: (v + 12) / 24 })}
                        onReset={() => updateMasterEffects({ reverb: 0 })} />
                      <Knob size={26} label="WOW" color="#3399ff"
                        value={tapeEffects.wow * 24 - 12}
                        onChange={(v) => updateMasterEffects({ wow: (v + 12) / 24 })}
                        onReset={() => updateMasterEffects({ wow: 0 })} />
                    </div>
                    <div className="flex gap-1.5">
                      <Knob size={26} label="FLT" color="#00ffcc"
                        value={tapeEffects.flutter * 24 - 12}
                        onChange={(v) => updateMasterEffects({ flutter: (v + 12) / 24 })}
                        onReset={() => updateMasterEffects({ flutter: 0 })} />
                      <Knob size={26} label="FAD" color="#ffaa00"
                        value={fadeTime * 4 - 12}
                        onChange={(v) => setFadeTime((v + 12) / 4)}
                        onReset={() => setFadeTime(1.5)} />
                    </div>
                  </div>
                  <Knob size={46} label="MASTER" color="#d4af37"
                    value={masterVolume * 24 - 12}
                    onChange={(v) => {
                      const vol = (v + 12) / 24;
                      setMasterVolume(vol);
                      if (masterGainRef.current && audioContextRef.current)
                        masterGainRef.current.gain.setTargetAtTime(vol, audioContextRef.current.currentTime, 0.05);
                    }} />
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-3 opacity-50" style={{ borderTop: "1px solid #333" }}>
                <div className="text-[7px] leading-relaxed tracking-[0.15em] uppercase"
                  style={{ color: "#777", fontFamily: "'JetBrains Mono', monospace" }}>
                  8-Track Magnetic Composition Tool
                  <br />
                  archive.org remote collection active
                  <br />
                  <a href="https://davidsanchez.work" target="_blank" rel="noopener noreferrer"
                    className="hover:text-white transition-colors underline underline-offset-2">
                    davidsanchez.work
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
