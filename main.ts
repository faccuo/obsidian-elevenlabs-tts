import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, TFile, TFolder, setIcon } from 'obsidian';

// --- Interfaces ---

interface ElevenLabsSettings {
  apiKey: string;
  voiceId: string;
  style: 'default' | 'narrative' | 'expressive' | 'news';
  outputFolder: string;
  history: TTSHistoryEntry[];
  voices: VoiceOption[];
}

interface VoiceOption {
  id: string;
  name: string;
  category?: string;
}

interface TTSHistoryEntry {
  id: string;
  text: string;
  voiceName: string;
  date: number;
  audioPath: string;
  jsonPath: string;
}

interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

const DEFAULT_SETTINGS: ElevenLabsSettings = {
  apiKey: '',
  voiceId: '',
  style: 'default',
  outputFolder: 'TTS',
  history: [],
  voices: []
};

const VIEW_TYPE_TTS_PLAYER = 'elevenlabs-tts-player';

// --- Main Plugin Class ---

export default class ElevenLabsTTSPlugin extends Plugin {
  settings: ElevenLabsSettings;
  playerView: TTSPlayerView | null = null;

  async onload() {
    await this.loadSettings();

    // Register View
    this.registerView(
      VIEW_TYPE_TTS_PLAYER,
      (leaf) => (this.playerView = new TTSPlayerView(leaf, this))
    );

    // Ribbon Icon
    this.addRibbonIcon('mic', 'ElevenLabs TTS Player', () => {
      this.activateView();
    });

    // Commands
    this.addCommand({
      id: 'play-selection',
      name: 'Play selection',
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "G" }],
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const selectedText = editor.getSelection();
        if (selectedText) {
          this.generateAndPlay(selectedText);
        } else {
          new Notice('No text selected');
        }
      }
    });

    this.addCommand({
      id: 'open-player',
      name: 'Show player',
      callback: () => {
        this.activateView();
      }
    });

    // Settings Tab
    this.addSettingTab(new TTSSettingTab(this.app, this));
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TTS_PLAYER);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_TTS_PLAYER);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_TTS_PLAYER, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async generateAndPlay(text: string, voiceIdOverride?: string) {
    if (!this.settings.apiKey) {
      new Notice('Please set your ElevenLabs API Key in settings');
      return;
    }

    const voiceId = voiceIdOverride || this.settings.voiceId;

    if (!voiceId) {
      new Notice('Please select a voice in settings');
      return;
    }

    await this.activateView();
    if (this.playerView) {
      this.playerView.setLoading(true);
    }

    try {
      const modelId = 'eleven_multilingual_v2';

      // Prepare style settings
      let stability = 0.5;
      let similarity_boost = 0.75;
      let style = 0.0;

      switch (this.settings.style) {
        case 'narrative':
          stability = 0.5;
          similarity_boost = 0.8;
          style = 0.5;
          break;
        case 'expressive':
          stability = 0.3;
          similarity_boost = 0.8;
          style = 0.8;
          break;
        case 'news':
          stability = 0.7;
          similarity_boost = 0.75;
          style = 0.2;
          break;
        case 'default':
        default:
          break;
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.settings.apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost,
            style
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail?.message || 'API Error');
      }

      const data = await response.json();

      if (!data.audio_base64) {
        throw new Error('No audio data received');
      }

      // Save to vault
      await this.ensureOutputFolder();
      const timestamp = Date.now();
      const filename = `tts-${timestamp}`;
      const audioPath = `${this.settings.outputFolder}/${filename}.mp3`;
      const jsonPath = `${this.settings.outputFolder}/${filename}.json`;

      // Decode base64
      const binaryString = window.atob(data.audio_base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await this.app.vault.createBinary(audioPath, bytes.buffer);
      await this.app.vault.create(jsonPath, JSON.stringify({
        text: text,
        alignment: data.alignment,
        voiceId: voiceId,
        modelId: modelId,
        settings: { stability, similarity_boost, style }
      }, null, 2));

      // Add to history
      const voiceName = this.settings.voices.find(v => v.id === voiceId)?.name || 'Unknown Voice';
      const entry: TTSHistoryEntry = {
        id: filename,
        text: text,
        voiceName: voiceName,
        date: timestamp,
        audioPath: audioPath,
        jsonPath: jsonPath
      };

      this.settings.history.unshift(entry);
      if (this.settings.history.length > 20) {
        this.settings.history.pop();
      }
      await this.saveSettings();

      // Play
      if (this.playerView) {
        this.playerView.playEntry(entry, data.alignment);
        this.playerView.renderHistory();
      }

    } catch (error) {
      console.error(error);
      new Notice(`TTS Error: ${error.message}`);
    } finally {
      if (this.playerView) {
        this.playerView.setLoading(false);
      }
    }
  }

  async ensureOutputFolder() {
    if (!(await this.app.vault.adapter.exists(this.settings.outputFolder))) {
      await this.app.vault.createFolder(this.settings.outputFolder);
    }
  }
}

// --- Settings Tab ---

class TTSSettingTab extends PluginSettingTab {
  plugin: ElevenLabsTTSPlugin;

  constructor(app: App, plugin: ElevenLabsTTSPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'ElevenLabs TTS Settings' });

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Your ElevenLabs API Key')
      .addText(text => text
        .setPlaceholder('sk_...')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    const voiceOptions: Record<string, string> = {};
    this.plugin.settings.voices.forEach(v => {
      voiceOptions[v.id] = v.name;
    });

    new Setting(containerEl)
      .setName('Voice')
      .setDesc('Select the voice to use')
      .addDropdown(dropdown => dropdown
        .addOptions(voiceOptions)
        .setValue(this.plugin.settings.voiceId)
        .onChange(async (value) => {
          this.plugin.settings.voiceId = value;
          await this.plugin.saveSettings();
        }))
      .addExtraButton(button => button
        .setIcon('refresh-cw')
        .setTooltip('Refresh Voices')
        .onClick(async () => {
          await this.refreshVoices();
          this.display(); // Re-render to show new voices
        }));

    new Setting(containerEl)
      .setName('Style')
      .setDesc('Select a style preset')
      .addDropdown(dropdown => dropdown
        .addOption('default', 'Default')
        .addOption('narrative', 'Narrative (Storytelling)')
        .addOption('expressive', 'Expressive (Emotional)')
        .addOption('news', 'News (Formal)')
        .setValue(this.plugin.settings.style)
        .onChange(async (value: any) => {
          this.plugin.settings.style = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Output Folder')
      .setDesc('Folder to save generated audio files')
      .addText(text => text
        .setValue(this.plugin.settings.outputFolder)
        .onChange(async (value) => {
          this.plugin.settings.outputFolder = value;
          await this.plugin.saveSettings();
        }));
  }

  async refreshVoices() {
    if (!this.plugin.settings.apiKey) {
      new Notice('Please set API Key first');
      return;
    }
    try {
      new Notice('Fetching voices...');
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': this.plugin.settings.apiKey }
      });
      if (!response.ok) throw new Error('Failed to fetch voices');
      const data = await response.json();

      this.plugin.settings.voices = data.voices.map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category
      }));

      // Default to first voice if none selected
      if (!this.plugin.settings.voiceId && this.plugin.settings.voices.length > 0) {
        this.plugin.settings.voiceId = this.plugin.settings.voices[0].id;
      }

      await this.plugin.saveSettings();
      new Notice('Voices updated');
    } catch (error) {
      console.error(error);
      new Notice('Error fetching voices');
    }
  }
}

// --- Player View ---

class TTSPlayerView extends ItemView {
  plugin: ElevenLabsTTSPlugin;
  audio: HTMLAudioElement;
  currentEntry: TTSHistoryEntry | null = null;
  alignment: AlignmentData | null = null;

  // UI Elements
  container: HTMLElement;
  playerContainer: HTMLElement;
  historyContainer: HTMLElement;
  textContainer: HTMLElement;
  controlsContainer: HTMLElement;
  playBtn: HTMLButtonElement;
  progressBar: HTMLInputElement;
  voiceSelect: HTMLSelectElement;

  constructor(leaf: WorkspaceLeaf, plugin: ElevenLabsTTSPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.audio = new Audio();
    this.setupAudioListeners();
  }

  getViewType() { return VIEW_TYPE_TTS_PLAYER; }
  getDisplayText() { return 'ElevenLabs Player'; }
  getIcon() { return 'mic'; }

  async onOpen() {
    this.container = this.contentEl;
    this.container.empty();
    this.container.addClass('elevenlabs-player-view');

    // 1. Player Area
    this.playerContainer = this.container.createDiv('player-container');

    // Text / Karaoke Area
    this.textContainer = this.playerContainer.createDiv('text-display');
    this.textContainer.setText('Ready to play...');

    // Controls
    this.controlsContainer = this.playerContainer.createDiv('controls');

    // Row 1: Playback Controls
    const playbackRow = this.controlsContainer.createDiv('controls-row');

    // Play/Pause
    this.playBtn = playbackRow.createEl('button', { cls: 'control-btn play-btn' });
    setIcon(this.playBtn, 'play');
    this.playBtn.onclick = () => this.togglePlay();

    // Stop
    const stopBtn = playbackRow.createEl('button', { cls: 'control-btn' });
    setIcon(stopBtn, 'square');
    stopBtn.onclick = () => this.stop();

    // Speed
    const speedSelect = playbackRow.createEl('select', { cls: 'speed-select' });
    [0.75, 1.0, 1.25, 1.5].forEach(rate => {
      const opt = speedSelect.createEl('option', { text: `${rate}x`, value: String(rate) });
      if (rate === 1.0) opt.selected = true;
    });
    speedSelect.onchange = () => {
      this.audio.playbackRate = parseFloat(speedSelect.value);
    };

    // Row 2: Progress
    this.progressBar = this.controlsContainer.createEl('input', { type: 'range', cls: 'progress-bar' });
    this.progressBar.min = '0';
    this.progressBar.max = '100';
    this.progressBar.value = '0';
    this.progressBar.oninput = () => {
      const time = (parseFloat(this.progressBar.value) / 100) * this.audio.duration;
      this.audio.currentTime = time;
    };

    // Row 3: Regeneration Controls
    const regenRow = this.controlsContainer.createDiv('controls-row regen-row');

    this.voiceSelect = regenRow.createEl('select', { cls: 'voice-select' });
    this.updateVoiceOptions();

    const regenBtn = regenRow.createEl('button', { cls: 'regen-btn', text: 'Regenerate' });
    setIcon(regenBtn, 'refresh-cw');
    regenBtn.onclick = () => {
      if (this.currentEntry) {
        const selectedVoice = this.voiceSelect.value;
        this.plugin.generateAndPlay(this.currentEntry.text, selectedVoice);
      } else {
        new Notice('Nothing to regenerate');
      }
    };

    // 2. History Area
    this.historyContainer = this.container.createDiv('history-container');
    this.renderHistory();
  }

  updateVoiceOptions() {
    if (!this.voiceSelect) return;
    this.voiceSelect.empty();
    this.plugin.settings.voices.forEach(v => {
      const opt = this.voiceSelect.createEl('option', { text: v.name, value: v.id });
      if (v.id === this.plugin.settings.voiceId) opt.selected = true;
    });
  }

  setupAudioListeners() {
    this.audio.addEventListener('timeupdate', () => {
      if (!isNaN(this.audio.duration)) {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressBar.value = String(progress);
      }
      this.updateKaraoke(this.audio.currentTime);
    });

    this.audio.addEventListener('ended', () => {
      setIcon(this.playBtn, 'play');
      this.progressBar.value = '0';
    });

    this.audio.addEventListener('play', () => setIcon(this.playBtn, 'pause'));
    this.audio.addEventListener('pause', () => setIcon(this.playBtn, 'play'));
  }

  togglePlay() {
    if (this.audio.paused) {
      if (this.audio.src) this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setLoading(loading: boolean) {
    if (loading) {
      this.textContainer.setText('Generating audio...');
      this.textContainer.addClass('loading');
    } else {
      this.textContainer.removeClass('loading');
    }
  }

  async deleteEntry(entry: TTSHistoryEntry) {
    // Remove files
    try {
      const audioFile = this.plugin.app.vault.getAbstractFileByPath(entry.audioPath);
      if (audioFile) await this.plugin.app.vault.delete(audioFile);

      const jsonFile = this.plugin.app.vault.getAbstractFileByPath(entry.jsonPath);
      if (jsonFile) await this.plugin.app.vault.delete(jsonFile);
    } catch (e) {
      console.error('Error deleting files', e);
      new Notice('Error deleting files');
    }

    // Remove from history
    this.plugin.settings.history = this.plugin.settings.history.filter(h => h.id !== entry.id);
    await this.plugin.saveSettings();

    // Refresh view
    this.renderHistory();

    // If this was the current entry, clear player
    if (this.currentEntry && this.currentEntry.id === entry.id) {
      this.stop();
      this.textContainer.setText('Ready to play...');
      this.currentEntry = null;
      this.alignment = null;
    }
  }

  async playEntry(entry: TTSHistoryEntry, alignmentData?: AlignmentData) {
    this.currentEntry = entry;

    // Load Audio
    const audioFile = this.plugin.app.vault.getAbstractFileByPath(entry.audioPath);
    if (audioFile instanceof TFile) {
      const arrayBuffer = await this.plugin.app.vault.readBinary(audioFile);
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      this.audio.src = url;

      // Attempt to play
      try {
        await this.audio.play();
      } catch (e) {
        console.error('Playback failed', e);
        // Sometimes user interaction is required, but here we are inside a click handler usually.
      }
    } else {
      new Notice('Audio file not found');
      return;
    }

    // Load Alignment
    if (alignmentData) {
      this.alignment = alignmentData;
    } else {
      // Try to load from JSON sidecar
      const jsonFile = this.plugin.app.vault.getAbstractFileByPath(entry.jsonPath);
      if (jsonFile instanceof TFile) {
        try {
          const content = await this.plugin.app.vault.read(jsonFile);
          const data = JSON.parse(content);
          this.alignment = data.alignment;
        } catch (e) {
          console.error('Failed to load alignment JSON', e);
          this.alignment = null;
        }
      } else {
        this.alignment = null;
      }
    }

    this.renderKaraokeText(entry.text);
  }

  renderKaraokeText(text: string) {
    this.textContainer.empty();

    if (!this.alignment) {
      this.textContainer.setText(text);
      return;
    }

    const words = text.split(/(\s+)/);
    let charIndex = 0;

    words.forEach((word, i) => {
      const span = this.textContainer.createEl('span', { text: word });
      span.dataset.startIndex = String(charIndex);
      span.dataset.endIndex = String(charIndex + word.length);

      // Click to seek
      span.onclick = () => {
        const startIdx = parseInt(span.dataset.startIndex!);
        // Find start time for this char index
        if (this.alignment && this.alignment.character_start_times_seconds[startIdx] !== undefined) {
          const time = this.alignment.character_start_times_seconds[startIdx];
          this.audio.currentTime = time;
          if (this.audio.paused) this.audio.play();
        }
      };

      charIndex += word.length;

      if (word.trim().length > 0) {
        span.addClass('tts-word');
      }
    });
  }

  updateKaraoke(currentTime: number) {
    if (!this.alignment) return;

    const times = this.alignment.character_start_times_seconds;
    const durations = this.alignment.character_end_times_seconds;

    let activeCharIndex = -1;
    for (let i = 0; i < times.length; i++) {
      if (currentTime >= times[i] && currentTime < durations[i]) {
        activeCharIndex = i;
        break;
      }
    }

    if (activeCharIndex !== -1) {
      const spans = this.textContainer.querySelectorAll('.tts-word');
      spans.forEach((span: HTMLElement) => {
        const start = parseInt(span.dataset.startIndex!);
        const end = parseInt(span.dataset.endIndex!);

        if (activeCharIndex >= start && activeCharIndex < end) {
          span.addClass('active');
          span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } else {
          span.removeClass('active');
        }
      });
    }
  }

  renderHistory() {
    this.historyContainer.empty();
    this.historyContainer.createEl('h3', { text: 'History' });

    const list = this.historyContainer.createDiv('history-list');

    this.plugin.settings.history.forEach(entry => {
      const item = list.createDiv('history-item');

      // Make the whole item clickable to play
      item.onclick = () => {
        this.playEntry(entry);
      };

      const info = item.createDiv('history-info');
      info.createDiv('history-text').setText(entry.text.slice(0, 50) + (entry.text.length > 50 ? '...' : ''));
      info.createDiv('history-meta').setText(`${entry.voiceName} • ${new Date(entry.date).toLocaleTimeString()}`);

      const actions = item.createDiv('history-actions');

      // Play Button (redundant if row is clickable, but good for clarity)
      const playBtn = actions.createEl('button', { cls: 'history-action-btn' });
      setIcon(playBtn, 'play');
      playBtn.onclick = (e) => {
        e.stopPropagation();
        this.playEntry(entry);
      };

      // Delete Button
      const deleteBtn = actions.createEl('button', { cls: 'history-action-btn delete-btn' });
      setIcon(deleteBtn, 'trash');
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deleteEntry(entry);
      };
    });
  }
}