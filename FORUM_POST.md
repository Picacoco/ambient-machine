# Ambient Machine — An 8-track soundscape builder that pulls random audio from the Internet Archive

**[ambientmachine.netlify.app](https://ambientmachine.netlify.app/)**

I built a browser-based tool for creating live ambient soundscapes using random recordings from Archive.org. No samples to download, no plugins needed — just open the URL and start mixing.

## The idea

The Internet Archive has millions of audio files — field recordings, shortwave transmissions, tape loops, radio static, drone music — most of which nobody has listened to in years. Ambient Machine turns this forgotten archive into a performative instrument.

You get 8 channels, each searching a different corner of Archive.org:

- **T1–T4 (FIELD):** Nature recordings, urban soundscapes, bioacoustics, rain, underwater recordings, industrial ambience
- **T5–T6 (DRONE):** Ambient drones, modular synth, singing bowls, tanpura, dark ambient, tape loops
- **T7 (MYSTERY):** Numbers stations, shortwave, VLF recordings, electromagnetic phenomena, morse code, space sounds
- **T8 (RADIO):** AM radio, ham radio, pirate broadcasts, aviation scanners, emergency frequencies

## How it works

Hit the dice icon on any channel and it fetches a random recording from Archive.org matching that channel's category. The current track fades out automatically (speed controlled by the FAD knob), the fader drops to zero, and you bring the new sound in at your own pace. Every session is different — you never know what you'll get.

Each channel has a 3-band EQ and individual fader. On the master bus there's convolution reverb (12-second impulse) and tape effects modeled after the Chase Bliss Generation Loss — a slow WOW (pitch warble) and fast FLUTTER for that degraded cassette character.

## Recording sessions

Hit REC and everything going through the master bus gets captured as a WebM file. When you stop, it also downloads a timestamped credits log with links to every Archive.org item used — so you can always trace back to the original sources and credit the uploaders.

## Try it

**[ambientmachine.netlify.app](https://ambientmachine.netlify.app/)** — works in any modern browser, no install. The source is on GitHub if you want to look under the hood or contribute.

Built with React, Web Audio API, and the Archive.org search API. Would love to hear what soundscapes you end up creating with it.
