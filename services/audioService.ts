class AudioService {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  private init() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 2, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0;
    source.connect(filter);
    filter.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    source.start();
  }

  public async startScrubbing() {
    this.init();
    if (this.audioContext?.state === 'suspended') await this.audioContext.resume();
    this.gainNode?.gain.setTargetAtTime(0.1, this.audioContext!.currentTime, 0.05);
  }

  public stopScrubbing() {
    this.gainNode?.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.1);
  }
}
export const audioService = new AudioService();
