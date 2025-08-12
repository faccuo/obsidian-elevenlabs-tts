# ElevenLabs TTS (Obsidian Plugin)

Convert text to speech using ElevenLabs. Includes a player view with controls, history, and optional word-by-word highlight (karaoke).

## Installation

- BRAT (beta): Install the "Beta Reviewers Auto-update Tester" plugin and add `faccuo/obsidian-elevenlabs-tts`.
- Manual: Download `manifest.json`, `main.js`, and `styles.css` from Releases and place them in `<your-vault>/.obsidian/plugins/elevenlabs-tts/`.
- Community: Once approved, install from Community Plugins.

## Usage

- Command palette:
  - Play selection with ElevenLabs
  - Play current paragraph with ElevenLabs
  - Open/Close TTS player
  - Toggle overlay (karaoke)
- Ribbon icon on the sidebar to open the player.

## Settings

- ElevenLabs API Key
- Voice: select from your account or enter a Voice ID manually
- Model
- Stability, similarity boost, style, speaker boost
- Output format (mp3/wav)
- Save to vault (subfolder per note)
- History limit
- Interface language (EN/ES)
- Sidecar .json with metadata
- Word-by-word overlay

## Privacy

- The API key is stored locally via `this.saveData()`. Nothing is sent except the explicit request to ElevenLabs to generate audio.
- You can disable file saving and the sidecar.

## Releases

- Release assets should include `manifest.json`, `main.js`, and `styles.css`.
- `versions.json` keeps the compatibility mapping per Obsidian version.

## Development

- Requirements: Node 18+, esbuild
- Scripts:
  - `npm run dev` / `npm run watch`: build in watch mode
  - `npm run build`: production build

License: MIT 