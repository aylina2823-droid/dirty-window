
class AudioService {
  private audioContext: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  private init() {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const bufferSize = 2 * this.audioContext.sampleRate;
      const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noiseNode = this.audioContext.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 1000;

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0;

      this.noiseNode.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      
      this.noiseNode.start();
    } catch (e) {
      console.error("Audio init error:", e);
    }
  }

  public async startScrubbing() {
    if (!this.audioContext) this.init();
    
    // Принудительное возобновление (важно для iOS Safari/Telegram)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn("Audio resume failed", e);
      }
    }
    
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(0.15, this.audioContext.currentTime, 0.04);
    }
  }

  public stopScrubbing() {
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.08);
    }
  }
}

export const audioService = new AudioService();
