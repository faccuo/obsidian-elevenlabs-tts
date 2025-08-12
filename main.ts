import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFolder, TFile, ItemView, WorkspaceLeaf } from 'obsidian';

type Lang = 'es' | 'en';

interface ElevenlabsVoice { voice_id: string; name: string }

interface ElevenlabsSettings {
  apiKey: string;
  voiceId: string;
  modelId: string;
  saveToVault: boolean;
  outputFolder: string;
  historyLimit: number;
  history: TTSHistoryEntry[];
  language: Lang;
  writeSidecar: boolean;
  overlayEnabled: boolean;
  stability: number; // 0..1
  similarityBoost: number; // 0..1
  style: number; // 0..100
  useSpeakerBoost: boolean;
  outputFormat: string;
  voices: ElevenlabsVoice[];
  voicesLastFetch?: number;
}

interface TTSHistoryEntry {
  path: string;
  createdAt: number;
  sourceNotePath?: string;
  textSnippet?: string;
  fullText?: string;
}

const I18N: Record<Lang, Record<string, string>> = {
  es: {
    'cmd.playSelection': 'Reproducir selección con ElevenLabs',
    'cmd.playParagraph': 'Reproducir párrafo actual con ElevenLabs',
    'cmd.stop': 'Detener reproducción TTS',
    'cmd.openPlayer': 'Abrir reproductor TTS',
    'cmd.closePlayer': 'Cerrar reproductor TTS',
    'cmd.toggleOverlay': 'Alternar overlay de palabras (karaoke)',
    'cmd.preset.expressive': 'Ajustes rápidos: Expresivo',
    'cmd.preset.neutral': 'Ajustes rápidos: Neutral',
    'cmd.preset.narration': 'Ajustes rápidos: Narración',

    'notice.configureKeys': 'Configura tu API Key y Voice ID de ElevenLabs en los ajustes del plugin.',
    'notice.noText': 'No hay texto para reproducir.',
    'notice.saveFail': 'No se pudo guardar el audio en la bóveda.',
    'notice.fileNotFound': 'Archivo no encontrado en historial.',
    'notice.errorPrefix': 'Error al generar audio: ',
    'notice.overlayOn': 'Overlay activado',
    'notice.overlayOff': 'Overlay desactivado',
    'notice.voicesLoaded': 'Voces actualizadas',
    'notice.voicesLoadError': 'Error al cargar voces',
    'notice.presetApplied': 'Preset aplicado:',

    'view.title': 'Reproductor TTS',

    'controls.play': 'Reproducir',
    'controls.pause': 'Pausar',
    'controls.stop': 'Detener',
    'controls.seek': 'Desplazar',
    'controls.speed': 'Velocidad',
    'controls.mute': 'Silenciar',

    'history.title': 'Historial de generaciones',
    'history.clear': 'Limpiar',
    'history.empty': 'Sin entradas todavía.',

    'pending.generating': 'Generando audio…',

    'settings.title': 'Configuración de ElevenLabs',
    'settings.apiKey.name': 'API Key',
    'settings.apiKey.desc': 'Clave de la API de ElevenLabs',
    'settings.voiceId.name': 'Voice ID (manual)',
    'settings.voiceId.desc': 'Introduce un Voice ID manualmente',
    'settings.voices.name': 'Mis voces',
    'settings.voices.desc': 'Selecciona una voz de tu cuenta',
    'settings.voices.refresh': 'Actualizar voces',
    'settings.voices.empty': 'No se han cargado voces todavía',

    'settings.model.name': 'Modelo',
    'settings.model.desc': 'Modelo de ElevenLabs a usar',
    'settings.save.name': 'Guardar audio en bóveda',
    'settings.save.desc': 'Si está activo, guarda cada audio generado en la carpeta especificada (dentro de la carpeta de la nota actual)',
    'settings.subfolder.name': 'Subcarpeta de salida',
    'settings.subfolder.desc': 'Nombre de la subcarpeta dentro de la carpeta de la nota (por ejemplo, TTS)',
    'settings.historyLimit.name': 'Historial: máximo elementos',
    'settings.historyLimit.desc': 'Límite de entradas guardadas en el historial de generaciones',
    'settings.language.name': 'Idioma',
    'settings.language.desc': 'Idioma de la interfaz del plugin',
    'settings.sidecar.name': 'Guardar metadatos (sidecar .json)',
    'settings.sidecar.desc': 'Escribe un archivo .json junto al MP3 con el texto, voz y modelo para reconstruir overlay.',
    'settings.overlay.name': 'Mostrar overlay (karaoke)',
    'settings.overlay.desc': 'Resalta palabra a palabra durante la reproducción en la vista TTS.',

    'settings.voice.stability.name': 'Estabilidad',
    'settings.voice.stability.desc': '0: muy expresivo, 1: más estable',
    'settings.voice.similarity.name': 'Similitud',
    'settings.voice.similarity.desc': '0: libre, 1: similar a la voz base',
    'settings.voice.style.name': 'Estilo',
    'settings.voice.style.desc': 'Mayor valor suele aportar más expresividad (0–100)',
    'settings.voice.boost.name': 'Speaker boost',
    'settings.voice.boost.desc': 'Mejora la presencia/claridad de la voz',
    'settings.outputFormat.name': 'Formato de salida',
    'settings.outputFormat.desc': 'Formato/bitrate del audio generado'
  },
  en: {
    'cmd.playSelection': 'Play selection with ElevenLabs',
    'cmd.playParagraph': 'Play current paragraph with ElevenLabs',
    'cmd.stop': 'Stop TTS Playback',
    'cmd.openPlayer': 'Open TTS Player',
    'cmd.closePlayer': 'Close TTS Player',
    'cmd.toggleOverlay': 'Toggle word overlay (karaoke)',
    'cmd.preset.expressive': 'Quick preset: Expressive',
    'cmd.preset.neutral': 'Quick preset: Neutral',
    'cmd.preset.narration': 'Quick preset: Narration',

    'notice.configureKeys': 'Set your ElevenLabs API Key and Voice ID in the plugin settings.',
    'notice.noText': 'No text to play.',
    'notice.saveFail': 'Could not save audio to the vault.',
    'notice.fileNotFound': 'File not found in history.',
    'notice.errorPrefix': 'Error generating audio: ',
    'notice.overlayOn': 'Overlay enabled',
    'notice.overlayOff': 'Overlay disabled',
    'notice.voicesLoaded': 'Voices refreshed',
    'notice.voicesLoadError': 'Failed to load voices',
    'notice.presetApplied': 'Preset applied:',

    'view.title': 'TTS Player',

    'controls.play': 'Play',
    'controls.pause': 'Pause',
    'controls.stop': 'Stop',
    'controls.seek': 'Seek',
    'controls.speed': 'Speed',
    'controls.mute': 'Mute',

    'history.title': 'Generations history',
    'history.clear': 'Clear',
    'history.empty': 'No entries yet.',

    'pending.generating': 'Generating audio…',

    'settings.title': 'ElevenLabs Settings',
    'settings.apiKey.name': 'API Key',
    'settings.apiKey.desc': 'Your ElevenLabs API key',
    'settings.voiceId.name': 'Voice ID (manual)',
    'settings.voiceId.desc': 'Enter a Voice ID manually',
    'settings.voices.name': 'My voices',
    'settings.voices.desc': 'Select a voice from your account',
    'settings.voices.refresh': 'Refresh voices',
    'settings.voices.empty': 'No voices loaded yet',

    'settings.model.name': 'Model',
    'settings.model.desc': 'ElevenLabs model to use',
    'settings.save.name': 'Save audio to vault',
    'settings.save.desc': 'If enabled, saves each generated audio into the specified folder (inside the current note folder)',
    'settings.subfolder.name': 'Output subfolder',
    'settings.subfolder.desc': 'Subfolder name within the note folder (e.g., TTS)',
    'settings.historyLimit.name': 'History: max items',
    'settings.historyLimit.desc': 'Maximum number of entries to keep in history',
    'settings.language.name': 'Language',
    'settings.language.desc': 'Plugin interface language',
    'settings.sidecar.name': 'Save metadata (sidecar .json)',
    'settings.sidecar.desc': 'Writes a .json next to the MP3 with text, voice and model to rebuild overlay.',
    'settings.overlay.name': 'Show overlay (karaoke)',
    'settings.overlay.desc': 'Highlights word-by-word while playing in the TTS view.',

    'settings.voice.stability.name': 'Stability',
    'settings.voice.stability.desc': '0: very expressive, 1: more stable',
    'settings.voice.similarity.name': 'Similarity boost',
    'settings.voice.similarity.desc': '0: free, 1: closer to base voice',
    'settings.voice.style.name': 'Style',
    'settings.voice.style.desc': 'Higher often yields more expressiveness (0–100)',
    'settings.voice.boost.name': 'Speaker boost',
    'settings.voice.boost.desc': 'Improves presence/clarity of the voice',
    'settings.outputFormat.name': 'Output format',
    'settings.outputFormat.desc': 'Generated audio format/bitrate'
  }
};

const DEFAULT_SETTINGS: ElevenlabsSettings = {
  apiKey: '',
  voiceId: '',
  modelId: 'eleven_multilingual_v2',
  saveToVault: false,
  outputFolder: 'TTS',
  historyLimit: 50,
  history: [],
  language: 'es',
  writeSidecar: true,
  overlayEnabled: true,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  outputFormat: 'mp3_44100_128',
  voices: [],
};

interface WordTiming { index: number; start: number; end: number; text: string; }

const VIEW_TYPE_TTS = 'elevenlabs-tts-player';

export default class ElevenLabsTTSPlugin extends Plugin {
  settings!: ElevenlabsSettings;
  private audioEl: HTMLAudioElement | null = null;
  private overlay: TTSOverlay | null = null;
  private playerView: TTSPlayerView | null = null;
  private currentText: string = '';
  private currentTokens: string[] = [];
  private currentTimings: WordTiming[] = [];

  t(key: string): string {
    const lang = this.settings?.language ?? 'es';
    return I18N[lang]?.[key] ?? I18N.en[key] ?? key;
  }

  async onload() {
    await this.loadSettings();

    // Quick access ribbon icon
    this.addRibbonIcon('audio-file', this.t('cmd.openPlayer'), async () => {
      await this.openPlayerView();
    });

    this.registerView(VIEW_TYPE_TTS, (leaf) => new TTSPlayerView(leaf, this));
    this.addSettingTab(new TTSSettingTab(this.app, this));

    this.addCommand({
      id: 'tts-play-selection',
      name: this.t('cmd.playSelection'),
      editorCallback: async (editor: Editor) => {
        const selection = editor.getSelection();
        const text = selection || editor.getValue();
        await this.playText(text);
      },
    });

    this.addCommand({
      id: 'tts-play-paragraph',
      name: this.t('cmd.playParagraph'),
      editorCallback: async (editor: Editor) => {
        const para = this.extractCurrentParagraph(editor);
        await this.playText(para);
      },
    });

    this.addCommand({
      id: 'tts-open-player',
      name: this.t('cmd.openPlayer'),
      callback: async () => { await this.openPlayerView(); },
    });

    this.addCommand({
      id: 'tts-close-player',
      name: this.t('cmd.closePlayer'),
      callback: async () => {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_TTS).forEach((l) => l.detach());
      },
    });

    this.addCommand({
      id: 'tts-toggle-overlay',
      name: this.t('cmd.toggleOverlay'),
      callback: async () => {
        this.settings.overlayEnabled = !this.settings.overlayEnabled;
        await this.saveSettings();
        new Notice(this.settings.overlayEnabled ? this.t('notice.overlayOn') : this.t('notice.overlayOff'));
      },
    });

    this.addCommand({
      id: 'tts-stop',
      name: this.t('cmd.stop'),
      callback: () => this.stopAndCleanup(),
    });

    // Preset commands
    this.addCommand({
      id: 'tts-preset-expressive',
      name: this.t('cmd.preset.expressive'),
      callback: async () => {
        this.settings.stability = 0.25;
        this.settings.similarityBoost = 0.6;
        this.settings.style = 40;
        this.settings.useSpeakerBoost = true;
        await this.saveSettings();
        new Notice(`${this.t('notice.presetApplied')} ${this.t('cmd.preset.expressive')}`);
      }
    });

    this.addCommand({
      id: 'tts-preset-neutral',
      name: this.t('cmd.preset.neutral'),
      callback: async () => {
        this.settings.stability = 0.8;
        this.settings.similarityBoost = 0.9;
        this.settings.style = 5;
        this.settings.useSpeakerBoost = true;
        await this.saveSettings();
        new Notice(`${this.t('notice.presetApplied')} ${this.t('cmd.preset.neutral')}`);
      }
    });

    this.addCommand({
      id: 'tts-preset-narration',
      name: this.t('cmd.preset.narration'),
      callback: async () => {
        this.settings.stability = 0.6;
        this.settings.similarityBoost = 0.8;
        this.settings.style = 20;
        this.settings.useSpeakerBoost = true;
        await this.saveSettings();
        new Notice(`${this.t('notice.presetApplied')} ${this.t('cmd.preset.narration')}`);
      }
    });

    // Context menu: only three items
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, view) => {
        const sel = editor.getSelection()?.trim() ?? '';
        if (sel.length > 0) {
          menu.addItem((item) =>
            item.setTitle(this.t('cmd.playSelection')).onClick(async () => {
              await this.playText(sel);
            })
          );
        }
        menu.addItem((item) =>
          item.setTitle(this.t('cmd.playParagraph')).onClick(async () => {
            const para = this.extractCurrentParagraph(editor);
            await this.playText(para);
          })
        );
        menu.addItem((item) =>
          item.setTitle(this.t('cmd.closePlayer')).onClick(async () => {
            this.app.workspace.getLeavesOfType(VIEW_TYPE_TTS).forEach((l) => l.detach());
          })
        );
      })
    );

    // Reabrir la vista al abrir un MP3 generado
    this.registerEvent(
      this.app.workspace.on('file-open', async (file) => {
        if (file instanceof TFile && file.extension.toLowerCase() === 'mp3') {
          const found = this.settings.history.find((h) => h.path === file.path);
          const isGenerated = !!found || file.path.includes(`/${this.settings.outputFolder}/`);
          if (isGenerated) {
            let entry = found;
            if (!entry) {
              const basename = file.path.split('/').pop() ?? file.path;
              entry = {
                path: file.path,
                createdAt: (file.stat?.ctime ?? Date.now()),
                textSnippet: basename,
              };
              // intentar sidecar para enriquecer
              const sidecar = await this.readSidecar(file.path);
              if (sidecar) {
                entry.fullText = sidecar.fullText ?? entry.fullText;
                entry.textSnippet = sidecar.textSnippet ?? entry.textSnippet;
                entry.sourceNotePath = sidecar.sourceNotePath ?? entry.sourceNotePath;
              }
              this.trackHistory(entry);
            }
            await this.playHistory(entry!);
          }
        }
      })
    );
  }

  onunload() {
    this.stopAndCleanup();
    this.app.workspace.getLeavesOfType(VIEW_TYPE_TTS).forEach((l) => l.detach());
  }

  private extractCurrentParagraph(editor: Editor): string {
    const pos = editor.getCursor();
    const total = editor.lineCount();
    let start = pos.line;
    let end = pos.line;
    const isEmpty = (l: number) => editor.getLine(l).trim().length === 0;
    while (start > 0 && !isEmpty(start - 1)) start--;
    while (end < total - 1 && !isEmpty(end + 1)) end++;
    const lines: string[] = [];
    for (let i = start; i <= end; i++) lines.push(editor.getLine(i));
    const text = lines.join('\n').trim();
    return text.length > 0 ? text : editor.getLine(pos.line);
  }

  private async playText(text: string) {
    if (!this.settings.apiKey || !this.settings.voiceId) {
      new Notice(this.t('notice.configureKeys'));
      return;
    }
    if (!text || !text.trim()) {
      new Notice(this.t('notice.noText'));
      return;
    }
    if (!this.settings.voiceId.trim()) {
      new Notice(this.t('notice.configureKeys'));
      return;
    }

    // Abrir vista y mostrar pendiente
    const view = await this.openPlayerView();
    const snippet = (text.trim().split(/\n+/)[0] || text).slice(0, 140);
    view.showPendingGeneration(snippet, this.t('pending.generating'));

    try {
      // Solicitar TTS
      const { blob, audioUrl } = await convertTextToSpeech(text, this.settings);

      // Guardar si está habilitado
      if (this.settings.saveToVault) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const fileName = `${this.formatTimestamp(new Date())}.mp3`;
          const savedPath = await this.saveAudioToVault(fileName, arrayBuffer);
          const entry: TTSHistoryEntry = {
            path: savedPath,
            createdAt: Date.now(),
            sourceNotePath: this.app.workspace.getActiveFile()?.path,
            textSnippet: snippet,
            fullText: text.slice(0, 100000),
          };
          this.trackHistory(entry);
          if (this.settings.writeSidecar) {
            const stability = Math.max(0, Math.min(1, this.settings.stability));
            const similarity_boost = Math.max(0, Math.min(1, this.settings.similarityBoost));
            const style = Math.max(0, Math.min(100, this.settings.style)) / 100;
            await this.writeSidecar(savedPath, {
              path: savedPath,
              createdAt: entry.createdAt,
              sourceNotePath: entry.sourceNotePath,
              textSnippet: entry.textSnippet,
              fullText: entry.fullText,
              model_id: this.settings.modelId,
              voice_id: this.settings.voiceId,
              language: this.settings.language,
              voice_settings: {
                stability,
                similarity_boost,
                style,
                use_speaker_boost: !!this.settings.useSpeakerBoost
              },
              output_format: this.settings.outputFormat,
            });
          }
        } catch (e: any) {
          console.error(e);
          new Notice(this.t('notice.saveFail'));
        }
      }

      // Preparar audio y UI
      this.stopAndCleanup();
      this.currentText = text;
      this.setAudio(new Audio(audioUrl));

      this.bindPlayerView(view);

      // Overlay dentro de la vista
      if (this.settings.overlayEnabled) {
        this.overlay = new TTSOverlay(view.getOverlayContainer());
        this.currentTokens = this.overlay.tokenize(text);
        this.overlay.build(this.currentTokens);
        this.overlay.onWordClick = (index) => {
          const timing = this.currentTimings.find((t) => t.index === index);
          if (timing && this.audioEl) {
            this.audioEl.currentTime = timing.start + 0.01;
            if (this.audioEl.paused) this.audioEl.play();
          }
        };

        this.audioEl!.addEventListener('loadedmetadata', () => {
          // Timings aproximados (si no hay alignment del API)
          this.currentTimings = buildApproxTimings(this.currentTokens, this.audioEl!.duration);
        });

        this.audioEl!.addEventListener('timeupdate', () => {
          if (this.overlay && this.currentTimings.length) {
            this.overlay.highlightAtTime(this.currentTimings, this.audioEl!.currentTime);
          }
          view.updateTime(this.audioEl!);
        });
      } else {
        this.audioEl!.addEventListener('timeupdate', () => view.updateTime(this.audioEl!));
      }

      this.audioEl!.addEventListener('ended', () => view.onEnded());

      await this.audioEl!.play();
    } catch (err: any) {
      console.error(err);
      new Notice(this.t('notice.errorPrefix') + (err?.message ?? String(err)));
    } finally {
      // Ocultar pendiente
      const v = this.playerView ?? view;
      v?.clearPendingGeneration();
    }
  }

  private setAudio(audio: HTMLAudioElement) {
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch {}
      try { URL.revokeObjectURL(this.audioEl.src); } catch {}
    }
    this.audioEl = audio;
  }

  private async openPlayerView(): Promise<TTSPlayerView> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TTS)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      this.playerView = existing.view as unknown as TTSPlayerView;
      this.playerView.renderHistory(this.settings.history, {
        onPlayFromHistory: (e) => this.playHistory(e),
        onClearHistory: () => this.clearHistory(),
      });
      return this.playerView;
    }
    const right = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
    await right.setViewState({ type: VIEW_TYPE_TTS, active: true });
    this.playerView = right.view as unknown as TTSPlayerView;
    this.playerView.renderHistory(this.settings.history, {
      onPlayFromHistory: (e) => this.playHistory(e),
      onClearHistory: () => this.clearHistory(),
    });
    return this.playerView;
  }

  private bindPlayerView(view: TTSPlayerView) {
    if (!this.audioEl) return;
    view.bindToAudio(this.audioEl, {
      onPlay: () => this.audioEl!.play(),
      onPause: () => this.audioEl!.pause(),
      onStop: () => { this.audioEl!.pause(); this.audioEl!.currentTime = 0; },
      onSeek: (p) => { if (this.audioEl!.duration) this.audioEl!.currentTime = p * this.audioEl!.duration; },
      onRate: (r) => { this.audioEl!.playbackRate = r; },
      onMute: () => { this.audioEl!.muted = !this.audioEl!.muted; },
      onClose: () => this.stopAndCleanup(),
      onPlayFromHistory: async (entry) => { await this.playHistory(entry); },
      onClearHistory: async () => { await this.clearHistory(); },
      labels: {
        play: this.t('controls.play'),
        pause: this.t('controls.pause'),
        stop: this.t('controls.stop'),
        seek: this.t('controls.seek'),
        speed: this.t('controls.speed'),
        mute: this.t('controls.mute'),
      }
    });
  }

  private async saveAudioToVault(filename: string, arrayBuffer: ArrayBuffer): Promise<string> {
    // Guardar en la carpeta actual de la nota activa, dentro del subdirectorio configurado
    const active = this.app.workspace.getActiveFile();
    const parentPath = active?.parent?.path ?? '';
    const folderPath = parentPath ? `${parentPath}/${this.settings.outputFolder}` : this.settings.outputFolder;
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(existing instanceof TFolder)) {
      await this.app.vault.createFolder(folderPath);
    }
    const filePath = `${folderPath}/${filename}`;
    await this.app.vault.createBinary(filePath, arrayBuffer);
    return filePath;
  }

  private jsonPathForAudio(audioPath: string): string {
    if (audioPath.toLowerCase().endsWith('.mp3')) return audioPath.slice(0, -4) + '.json';
    return audioPath + '.json';
  }

  private async writeSidecar(audioPath: string, metadata: Record<string, any>) {
    const jsonPath = this.jsonPathForAudio(audioPath);
    const existing = this.app.vault.getAbstractFileByPath(jsonPath);
    const data = JSON.stringify(metadata, null, 2);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, data);
    } else {
      await this.app.vault.create(jsonPath, data);
    }
  }

  private async readSidecar(audioPath: string): Promise<any | null> {
    const jsonPath = this.jsonPathForAudio(audioPath);
    const existing = this.app.vault.getAbstractFileByPath(jsonPath);
    if (existing instanceof TFile) {
      try {
        const raw = await this.app.vault.read(existing);
        return JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to read sidecar JSON', e);
        return null;
      }
    }
    return null;
  }

  private async getTextForHistoryEntry(entry: TTSHistoryEntry): Promise<string | null> {
    if (entry.fullText && entry.fullText.trim().length > 0) return entry.fullText;
    // intentar sidecar
    const sidecar = await this.readSidecar(entry.path);
    if (sidecar && sidecar.fullText) return sidecar.fullText as string;
    if (entry.sourceNotePath) {
      const af = this.app.vault.getAbstractFileByPath(entry.sourceNotePath);
      if (af instanceof TFile) {
        try { return await this.app.vault.read(af); } catch {}
      }
    }
    return null;
  }

  async playHistory(entry: TTSHistoryEntry) {
    const af = this.app.vault.getAbstractFileByPath(entry.path);
    if (!(af instanceof TFile)) {
      new Notice(this.t('notice.fileNotFound'));
      return;
    }
    const data = await this.app.vault.readBinary(af);
    this.stopAndCleanup();
    const blob = new Blob([data], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    this.setAudio(new Audio(url));
    const view = await this.openPlayerView();
    this.bindPlayerView(view);

    // Reconstruir overlay a partir de texto persistido o nota origen
    const text = await this.getTextForHistoryEntry(entry);
    if (text && text.trim().length > 0 && this.settings.overlayEnabled) {
      this.overlay = new TTSOverlay(view.getOverlayContainer());
      this.currentTokens = this.overlay.tokenize(text);
      this.overlay.build(this.currentTokens);
      this.overlay.onWordClick = (index) => {
        const timing = this.currentTimings.find((t) => t.index === index);
        if (timing && this.audioEl) {
          this.audioEl.currentTime = timing.start + 0.01;
          if (this.audioEl.paused) this.audioEl.play();
        }
      };
      this.audioEl!.addEventListener('loadedmetadata', () => {
        this.currentTimings = buildApproxTimings(this.currentTokens, this.audioEl!.duration);
      });
      this.audioEl!.addEventListener('timeupdate', () => {
        if (this.overlay && this.currentTimings.length) {
          this.overlay.highlightAtTime(this.currentTimings, this.audioEl!.currentTime);
        }
        view.updateTime(this.audioEl!);
      });
    } else {
      this.audioEl!.addEventListener('timeupdate', () => view.updateTime(this.audioEl!));
    }

    await this.audioEl!.play();
  }

  trackHistory(entry: TTSHistoryEntry) {
    const normalized: TTSHistoryEntry = {
      ...entry,
      textSnippet: entry.textSnippet && entry.textSnippet.trim().length > 0
        ? entry.textSnippet
        : (entry.path.split('/').pop() ?? entry.path),
    };
    const hist = [normalized, ...this.settings.history].slice(0, Math.max(1, this.settings.historyLimit));
    this.settings.history = hist;
    this.saveSettings();
    if (this.playerView) this.playerView.renderHistory(this.settings.history, {
      onPlayFromHistory: (e) => this.playHistory(e),
      onClearHistory: () => this.clearHistory(),
    });
  }

  async clearHistory() {
    this.settings.history = [];
    await this.saveSettings();
    if (this.playerView) this.playerView.renderHistory(this.settings.history, {
      onPlayFromHistory: (e) => this.playHistory(e),
      onClearHistory: () => this.clearHistory(),
    });
  }

  stopAndCleanup() {
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch {}
      try { URL.revokeObjectURL(this.audioEl.src); } catch {}
      this.audioEl = null;
    }
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    this.currentText = '';
    this.currentTokens = [];
    this.currentTimings = [];
    // Mantener la vista abierta; el usuario puede cerrarla si quiere
  }

  private formatTimestamp(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      d.getFullYear().toString() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    // Normalizar historial (rellenar snippets vacíos)
    if (!Array.isArray(this.settings.history)) this.settings.history = [];
    this.settings.history = this.settings.history.map((e) => ({
      ...e,
      textSnippet: e.textSnippet && e.textSnippet.trim().length > 0
        ? e.textSnippet
        : (e.path?.split('/').pop() ?? e.path ?? ''),
    }));
    if (typeof this.settings.historyLimit !== 'number') this.settings.historyLimit = 50;
    if (this.settings.language !== 'es' && this.settings.language !== 'en') this.settings.language = 'es';
    if (typeof this.settings.writeSidecar !== 'boolean') this.settings.writeSidecar = true;
    if (typeof this.settings.overlayEnabled !== 'boolean') this.settings.overlayEnabled = true;
    if (typeof this.settings.stability !== 'number') this.settings.stability = DEFAULT_SETTINGS.stability;
    if (typeof this.settings.similarityBoost !== 'number') this.settings.similarityBoost = DEFAULT_SETTINGS.similarityBoost;
    if (typeof this.settings.style !== 'number') this.settings.style = DEFAULT_SETTINGS.style;
    if (typeof this.settings.useSpeakerBoost !== 'boolean') this.settings.useSpeakerBoost = DEFAULT_SETTINGS.useSpeakerBoost;
    if (typeof this.settings.outputFormat !== 'string') this.settings.outputFormat = DEFAULT_SETTINGS.outputFormat;
    if (!Array.isArray(this.settings.voices)) this.settings.voices = [];
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async refreshVoices() {
    if (!this.settings.apiKey) {
      new Notice(this.t('notice.configureKeys'));
      return;
    }
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': this.settings.apiKey },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      const voices: ElevenlabsVoice[] = Array.isArray(data?.voices)
        ? data.voices.map((v: any) => ({ voice_id: String(v?.voice_id ?? v?.voiceId ?? ''), name: String(v?.name ?? '') }))
        : [];
      this.settings.voices = voices.filter(v => v.voice_id && v.name);
      this.settings.voicesLastFetch = Date.now();
      await this.saveSettings();
      new Notice(this.t('notice.voicesLoaded'));
    } catch (e) {
      console.error(e);
      new Notice(this.t('notice.voicesLoadError'));
    }
  }
}

class TTSSettingTab extends PluginSettingTab {
  plugin: ElevenLabsTTSPlugin;

  constructor(app: App, plugin: ElevenLabsTTSPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: this.plugin.t('settings.title') });

    new Setting(containerEl)
      .setName(this.plugin.t('settings.apiKey.name'))
      .setDesc(this.plugin.t('settings.apiKey.desc'))
      .addText((text) =>
        text
          .setPlaceholder('')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Voices dropdown + refresh
    const voicesSetting = new Setting(containerEl)
      .setName(this.plugin.t('settings.voices.name'))
      .setDesc(this.plugin.t('settings.voices.desc'));

    voicesSetting.addDropdown((drop) => {
      const options: Record<string, string> = {};
      if (this.plugin.settings.voices.length === 0) {
        options[''] = this.plugin.t('settings.voices.empty');
      } else {
        for (const v of this.plugin.settings.voices) {
          options[v.voice_id] = `${v.name} (${v.voice_id.slice(0, 6)}…)`;
        }
      }
      drop.addOptions(options)
        .setValue(this.plugin.settings.voiceId || '')
        .onChange(async (value) => {
          if (!value) return; // ignore empty placeholder
          this.plugin.settings.voiceId = value;
          await this.plugin.saveSettings();
        });
    });

    voicesSetting.addButton((btn) =>
      btn.setButtonText(this.plugin.t('settings.voices.refresh')).onClick(async () => {
        await this.plugin.refreshVoices();
        this.display();
      })
    );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.voiceId.name'))
      .setDesc(this.plugin.t('settings.voiceId.desc'))
      .addText((text) =>
        text
          .setPlaceholder('')
          .setValue(this.plugin.settings.voiceId)
          .onChange(async (value) => {
            this.plugin.settings.voiceId = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.model.name'))
      .setDesc(this.plugin.t('settings.model.desc'))
      .addDropdown((drop) =>
        drop
          .addOptions({
            eleven_multilingual_v2: 'Multilingual v2',
            eleven_flash_v2_5: 'Flash v2.5',
            eleven_turbo_v2_5: 'Turbo v2.5',
          })
          .setValue(this.plugin.settings.modelId)
          .onChange(async (value) => {
            this.plugin.settings.modelId = value as string;
            await this.plugin.saveSettings();
          })
      );

    // Voice settings group
    new Setting(containerEl)
      .setName(this.plugin.t('settings.voice.stability.name'))
      .setDesc(this.plugin.t('settings.voice.stability.desc'))
      .addSlider((slider) =>
        slider.setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.stability)
          .onChange(async (v) => { this.plugin.settings.stability = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.voice.similarity.name'))
      .setDesc(this.plugin.t('settings.voice.similarity.desc'))
      .addSlider((slider) =>
        slider.setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.similarityBoost)
          .onChange(async (v) => { this.plugin.settings.similarityBoost = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.voice.style.name'))
      .setDesc(this.plugin.t('settings.voice.style.desc'))
      .addSlider((slider) =>
        slider.setLimits(0, 100, 1)
          .setValue(this.plugin.settings.style)
          .onChange(async (v) => { this.plugin.settings.style = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.voice.boost.name'))
      .setDesc(this.plugin.t('settings.voice.boost.desc'))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.useSpeakerBoost)
        .onChange(async (v) => { this.plugin.settings.useSpeakerBoost = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.outputFormat.name'))
      .setDesc(this.plugin.t('settings.outputFormat.desc'))
      .addDropdown((drop) => drop
        .addOptions({
          mp3_44100_128: 'mp3 44.1kHz 128kbps',
          mp3_44100_192: 'mp3 44.1kHz 192kbps',
          mp3_44100_320: 'mp3 44.1kHz 320kbps',
          wav: 'WAV',
          pcm_16000: 'PCM 16kHz',
        })
        .setValue(this.plugin.settings.outputFormat)
        .onChange(async (v) => { this.plugin.settings.outputFormat = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.save.name'))
      .setDesc(this.plugin.t('settings.save.desc'))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.saveToVault).onChange(async (value) => {
          this.plugin.settings.saveToVault = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.subfolder.name'))
      .setDesc(this.plugin.t('settings.subfolder.desc'))
      .addText((text) =>
        text
          .setPlaceholder('TTS')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value.trim() || 'TTS';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.historyLimit.name'))
      .setDesc(this.plugin.t('settings.historyLimit.desc'))
      .addText((text) =>
        text
          .setPlaceholder('50')
          .setValue(String(this.plugin.settings.historyLimit))
          .onChange(async (value) => {
            const n = Number(value);
            this.plugin.settings.historyLimit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.language.name'))
      .setDesc(this.plugin.t('settings.language.desc'))
      .addDropdown((drop) =>
        drop
          .addOptions({ es: 'Español', en: 'English' })
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = (value as Lang);
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.sidecar.name'))
      .setDesc(this.plugin.t('settings.sidecar.desc'))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.writeSidecar).onChange(async (value) => {
          this.plugin.settings.writeSidecar = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('settings.overlay.name'))
      .setDesc(this.plugin.t('settings.overlay.desc'))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.overlayEnabled).onChange(async (value) => {
          this.plugin.settings.overlayEnabled = value;
          await this.plugin.saveSettings();
        })
      );
  }
}

async function convertTextToSpeech(text: string, settings: ElevenlabsSettings) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${settings.voiceId}`;
  const stability = Math.max(0, Math.min(1, settings.stability));
  const similarity_boost = Math.max(0, Math.min(1, settings.similarityBoost));
  const style = Math.max(0, Math.min(100, settings.style)) / 100; // API expects 0..1
  const use_speaker_boost = !!settings.useSpeakerBoost;
  const body = {
    text,
    model_id: settings.modelId,
    output_format: settings.outputFormat,
    voice_settings: {
      stability,
      similarity_boost,
      style,
      use_speaker_boost,
    },
  } as Record<string, any>;

  const accept = body.output_format?.startsWith('mp3')
    ? 'audio/mpeg'
    : (body.output_format === 'wav' ? 'audio/wav' : 'application/octet-stream');

  // Timeout protection
  const controller = new AbortController();
  const timeoutMs = 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': accept,
      'xi-api-key': settings.apiKey,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    let errorText = '';
    try { errorText = await response.text(); } catch {}
    throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? `\n${errorText}` : ''}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: accept });
  const audioUrl = URL.createObjectURL(blob);
  return { blob, audioUrl };
}

class TTSOverlay {
  private root: HTMLElement | null;
  onWordClick?: (index: number) => void;

  constructor(root?: HTMLElement) {
    this.root = root ?? null;
  }

  mount(container: HTMLElement) { this.root = container; }
  destroy() { if (this.root) this.root.innerHTML = ''; }

  tokenize(text: string): string[] {
    return text.match(/\w+|[^\w\s]+|\s+/g) || [];
  }

  build(tokens: string[]) {
    if (!this.root) return;
    this.root.innerHTML = '';
    const frag = document.createDocumentFragment();
    tokens.forEach((tok, i) => {
      if (/^\w+$/.test(tok)) {
        const span = document.createElement('span');
        span.className = 'tts-word';
        span.dataset.index = String(i);
        span.textContent = tok;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(tok));
      }
    });
    this.root.appendChild(frag);

    this.root.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest('.tts-word') as HTMLElement | null;
      if (el && el.dataset.index) {
        const idx = Number(el.dataset.index);
        this.onWordClick?.(idx);
      }
    });
  }

  highlightAtTime(timings: WordTiming[], t: number) {
    if (!this.root || !timings.length) return;
    // binary search
    let lo = 0, hi = timings.length - 1, mid = 0, curr = -1;
    while (lo <= hi) {
      mid = (lo + hi) >> 1;
      const w = timings[mid];
      if (t < w.start) hi = mid - 1; else if (t > w.end) lo = mid + 1; else { curr = mid; break; }
    }
    const prev = this.root.querySelector('.tts-current');
    if (prev) prev.classList.remove('tts-current');
    const idx = curr >= 0 ? timings[curr].index : -1;
    if (idx >= 0) {
      const el = this.root.querySelector(`.tts-word[data-index="${idx}"]`);
      if (el) {
        el.classList.add('tts-current');
        (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }
}

function buildApproxTimings(tokens: string[], audioDuration: number): WordTiming[] {
  const wordIdxs = tokens.map((t, i) => (/^\w+$/.test(t) ? i : -1)).filter(i => i >= 0);
  const totalChars = wordIdxs.reduce((acc, i) => acc + tokens[i].length, 0) || 1;
  let accTime = 0;
  return wordIdxs.map((i) => {
    const frac = tokens[i].length / totalChars;
    const dur = audioDuration * frac;
    const wt: WordTiming = { index: i, start: accTime, end: accTime + dur, text: tokens[i] };
    accTime += dur;
    return wt;
  });
}

class TTSPlayerView extends ItemView {
  private plugin: ElevenLabsTTSPlugin;
  private overlayContainer!: HTMLDivElement;
  private controls!: HTMLDivElement;
  private historyContainer!: HTMLDivElement;
  private pendingEl: HTMLDivElement | null = null;
  private playBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private seek!: HTMLInputElement;
  private rate!: HTMLSelectElement;
  private mute!: HTMLButtonElement;

  constructor(leaf: WorkspaceLeaf, plugin: ElevenLabsTTSPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_TTS; }
  getDisplayText(): string { return this.plugin.t('view.title'); }
  getIcon(): string { return 'audio-file'; }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement; // contentEl
    container.empty();

    this.controls = container.createDiv({ cls: 'tts-controls' });
    this.controls.innerHTML = `
      <div class="controls-row">
        <button data-act="play" aria-label="${this.plugin.t('controls.play')}">▶</button>
        <button data-act="pause" aria-label="${this.plugin.t('controls.pause')}">⏸</button>
        <button data-act="stop" aria-label="${this.plugin.t('controls.stop')}">⏹</button>
        <input type="range" min="0" max="100" value="0" step="0.1" data-act="seek" aria-label="${this.plugin.t('controls.seek')}" />
        <select data-act="rate" aria-label="${this.plugin.t('controls.speed')}">
          <option value="0.75">0.75x</option>
          <option value="1" selected>1.0x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
        </select>
        <button data-act="mute" aria-label="${this.plugin.t('controls.mute')}">🔇</button>
      </div>
    `;

    this.playBtn = this.controls.querySelector('[data-act="play"]')!;
    this.pauseBtn = this.controls.querySelector('[data-act="pause"]')!;
    this.stopBtn = this.controls.querySelector('[data-act="stop"]')!;
    this.seek = this.controls.querySelector('[data-act="seek"]')! as HTMLInputElement;
    this.rate = this.controls.querySelector('[data-act="rate"]')! as HTMLSelectElement;
    this.mute = this.controls.querySelector('[data-act="mute"]')! as HTMLButtonElement;

    this.overlayContainer = container.createDiv({ cls: 'tts-overlay' });

    this.historyContainer = container.createDiv({ cls: 'tts-history' });
    // Render con handlers para permitir reproducción incluso sin audio asociado aún
    this.renderHistory(this.plugin.settings.history, {
      onPlayFromHistory: (e) => this.plugin.playHistory(e),
      onClearHistory: () => this.plugin.clearHistory(),
    });

    // Si ya hay audio activo, re-vincular
    if ((this.plugin as any)['audioEl']) {
      this.bindToAudio((this.plugin as any)['audioEl'] as HTMLAudioElement, {
        onPlay: () => (this.plugin as any)['audioEl'].play(),
        onPause: () => (this.plugin as any)['audioEl'].pause(),
        onStop: () => { (this.plugin as any)['audioEl'].pause(); (this.plugin as any)['audioEl'].currentTime = 0; },
        onSeek: (p: number) => { const a = (this.plugin as any)['audioEl'] as HTMLAudioElement; if (a.duration) a.currentTime = p * a.duration; },
        onRate: (r: number) => { (this.plugin as any)['audioEl'].playbackRate = r; },
        onMute: () => { (this.plugin as any)['audioEl'].muted = !(this.plugin as any)['audioEl'].muted; },
        onClose: () => this.plugin.stopAndCleanup(),
        onPlayFromHistory: (e) => this.plugin.playHistory(e),
        onClearHistory: () => this.plugin.clearHistory(),
        labels: {
          play: this.plugin.t('controls.play'),
          pause: this.plugin.t('controls.pause'),
          stop: this.plugin.t('controls.stop'),
          seek: this.plugin.t('controls.seek'),
          speed: this.plugin.t('controls.speed'),
          mute: this.plugin.t('controls.mute'),
        }
      });
    }
  }

  async onClose() {}

  getOverlayContainer() { return this.overlayContainer; }

  showPendingGeneration(snippet: string, generatingText: string) {
    if (!this.historyContainer) return;
    this.clearPendingGeneration();
    this.pendingEl = this.historyContainer.createDiv({ cls: 'tts-pending' });
    const row = this.pendingEl.createDiv({ cls: 'row' });
    const left = row.createDiv({ cls: 'left' });
    const right = row.createDiv({ cls: 'right' });
    left.createEl('div', { cls: 'snippet', text: snippet });
    left.createEl('div', { cls: 'meta', text: generatingText });
    right.createDiv({ cls: 'spinner' });
  }

  clearPendingGeneration() {
    if (this.pendingEl) { this.pendingEl.remove(); this.pendingEl = null; }
  }

  bindToAudio(audio: HTMLAudioElement, handlers: {
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onSeek: (p: number) => void;
    onRate: (r: number) => void;
    onMute: () => void;
    onClose: () => void;
    onPlayFromHistory: (entry: TTSHistoryEntry) => void | Promise<void>;
    onClearHistory: () => void | Promise<void>;
    labels?: { play: string; pause: string; stop: string; seek: string; speed: string; mute: string };
  }) {
    this.playBtn.onclick = handlers.onPlay;
    this.pauseBtn.onclick = handlers.onPause;
    this.stopBtn.onclick = handlers.onStop;
    this.seek.oninput = () => {
      if (audio.duration) handlers.onSeek(+this.seek.value / 100);
    };
    this.rate.onchange = () => handlers.onRate(parseFloat(this.rate.value));
    this.mute.onclick = handlers.onMute;

    if (handlers.labels) {
      this.playBtn.setAttr('aria-label', handlers.labels.play);
      this.pauseBtn.setAttr('aria-label', handlers.labels.pause);
      this.stopBtn.setAttr('aria-label', handlers.labels.stop);
      this.seek.setAttr('aria-label', handlers.labels.seek);
      this.rate.setAttr('aria-label', handlers.labels.speed);
      this.mute.setAttr('aria-label', handlers.labels.mute);
    }

    audio.addEventListener('timeupdate', () => this.updateTime(audio));

    // Re-render history controls with handlers
    this.renderHistory(this.plugin.settings.history, handlers);
  }

  renderHistory(entries: TTSHistoryEntry[], handlers?: { onPlayFromHistory: (entry: TTSHistoryEntry) => void | Promise<void>; onClearHistory: () => void | Promise<void> }) {
    if (!this.historyContainer) return;
    this.historyContainer.empty();

    // Mantener el pending al principio si existe
    if (this.pendingEl) {
      this.historyContainer.appendChild(this.pendingEl);
    }

    const header = this.historyContainer.createDiv({ cls: 'tts-history-header' });
    header.createEl('h4', { text: this.plugin.t('history.title') });
    const actions = header.createDiv({ cls: 'tts-history-actions' });
    const clearBtn = actions.createEl('button', { text: this.plugin.t('history.clear') });
    clearBtn.onclick = () => handlers?.onClearHistory?.();

    if (!entries.length) {
      this.historyContainer.createDiv({ text: this.plugin.t('history.empty') });
      return;
    }

    const list = this.historyContainer.createEl('ul', { cls: 'tts-history-list' });
    entries.forEach((e) => {
      const li = list.createEl('li', { cls: 'tts-history-item' });
      const row = li.createDiv({ cls: 'row' });
      const left = row.createDiv({ cls: 'left' });
      const right = row.createDiv({ cls: 'right' });
      const snippet = (e.textSnippet && e.textSnippet.trim().length > 0) ? e.textSnippet : (e.path.split('/').pop() ?? e.path);
      left.createEl('div', { cls: 'snippet', text: snippet });
      left.createEl('div', { cls: 'meta', text: `${new Date(e.createdAt).toLocaleString()} • ${e.sourceNotePath ?? ''}` });
      const play = right.createEl('button', { text: '▶', attr: { 'aria-label': this.plugin.t('controls.play') } });
      play.onclick = () => handlers?.onPlayFromHistory?.(e);
    });
  }

  updateTime(audio: HTMLAudioElement) {
    if (audio.duration) this.seek.value = String((audio.currentTime / audio.duration) * 100);
  }

  onEnded() {
    this.seek.value = '0';
  }
} 