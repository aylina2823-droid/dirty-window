
class AudioService {
  private audioContext: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  private init() {
    if (this.audioContext) return;
    
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create white noise buffer
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
    this.filterNode.frequency.value = 800;
    this.filterNode.Q.value = 1;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0;

    this.noiseNode.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    this.noiseNode.start();
  }

  public async startScrubbing() {
    if (!this.audioContext) this.init();
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.gainNode?.gain.setTargetAtTime(0.15, this.audioContext!.currentTime, 0.05);
    // Add some dynamic variation to filter to simulate pressure
    this.filterNode?.frequency.setTargetAtTime(1200, this.audioContext!.currentTime, 0.1);
  }

  public stopScrubbing() {
    if (!this.audioContext) return;
    this.gainNode?.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.05);
    this.filterNode?.frequency.setTargetAtTime(800, this.audioContext.currentTime, 0.1);
  }
}

export const audioService = new AudioService();
