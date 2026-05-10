# Ambient Machine

**An 8-track magnetic composition tool for building live soundscapes from the Internet Archive.**

🎛️ **[Try it live → ambientmachine.netlify.app](https://ambientmachine.netlify.app/)**

---

## What is this?

Ambient Machine is a browser-based mixing console that pulls random audio from [Archive.org](https://archive.org)'s vast collection and lets you layer, mix, and sculpt them into evolving soundscapes in real time.

Think of it as an instrument for generative ambient music — every session is unrepeatable, built from field recordings, drones, mysterious transmissions, and radio signals that you've never heard before.

## How it works

Each of the 8 channels is tuned to a different sonic territory:

| Channels | Type | What it finds |
|----------|------|---------------|
| T1 – T4 | **FIELD** | Field recordings, soundscapes, nature sounds, urban ambience, bioacoustics, underwater recordings, rain, thunder, wind, ocean, forest, industrial sounds |
| T5 – T6 | **DRONE** | Ambient drones, modular synth, singing bowls, harmoniums, tanpura, didgeridoo, tape loops, dark ambient, deep listening |
| T7 | **MYSTERY** | Shortwave radio, numbers stations, satellite transmissions, morse code, electromagnetic recordings, VLF, space sounds, hydrophone, cosmic noise |
| T8 | **RADIO** | AM radio, ham radio, pirate radio, aviation radio, weather radio, scanner, emergency broadcasts, radio static |

Hit the dice on any channel and it searches Archive.org, validates the audio can actually play, and loads it. The previous track fades out smoothly (controlled by the FAD knob), the fader drops to zero, and you bring the new sound in manually at your own pace.

## Features

### Mixing Console
- **8 independent channel strips** with vertical faders
- **3-band EQ per channel** (High / Mid / Low shelving filters)
- **Analog VU meters** for each channel + stereo master
- **Master volume** control

### Tape Effects
Inspired by the Chase Bliss Generation Loss:
- **RVB** — Convolution reverb with a 12-second supermassive impulse response
- **WOW** — Slow pitch warble (0.5Hz LFO modulating delay time)
- **FLT** — Fast flutter (12Hz modulation for tape-head instability)
- **FAD** — Controls the automatic fade-out duration when loading new tracks or stopping

### Transport
- **Play** — Resume all paused channels
- **REC** — Record your session as WebM audio, with a session log crediting every source from Archive.org
- **Stop** — Graceful fade-out of all channels (respects FAD setting), then stops playback and recording

### Session Recording
When you stop recording, you get two files:
1. **Audio file** (`.webm`) — Your full session mix
2. **Credits log** (`.txt`) — Timestamped log of every track loaded, with direct links to the original Archive.org items

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Web Audio API (MediaElementSource, BiquadFilters, ConvolverNode, DelayNode with LFO modulation, MediaRecorder)
- Archive.org Advanced Search API
- Deployed on Netlify

## Run locally

```bash
git clone https://github.com/YOUR-USERNAME/ambient-machine.git
cd ambient-machine
npm install
npm run dev
```

## Deploy

The repo includes a `netlify.toml` — just connect to Netlify and it builds automatically on every push.

## Credits

Built by [David Sanchez](https://davidsanchez.work).
All audio sourced from [Internet Archive](https://archive.org) collections.

## License

MIT
