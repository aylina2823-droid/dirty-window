
class AudioService {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isInitialized = false;

  private init() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const bufferSize = this.audioContext.sampleRate * 2;
      const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.audioContext.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const filterNode = this.audioContext.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 600; // Чуть выше частота для мобильных динамиков
      filterNode.Q.value = 0.5;

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0;

      noiseNode.connect(filterNode);
      filterNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      
      noiseNode.start();
      this.isInitialized = true;
    } catch (e) {
      console.error("Audio initialization failed", e);
    }
  }

  public async startScrubbing() {
    if (!this.isInitialized) this.init();
    
    // Критично для мобильных: возобновляем контекст при каждом взаимодействии
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    if (this.gainNode && this.audioContext) {
      // Громкость 0.1 вместо 0.04 для лучшей слышимости
      this.gainNode.gain.setTargetAtTime(0.1, this.audioContext.currentTime, 0.05);
    }
  }

  public stopScrubbing() {
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.15);
    }
  }
}

export const audioService = new AudioService();
