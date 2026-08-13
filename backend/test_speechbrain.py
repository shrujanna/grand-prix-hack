import sys
import io
import torch
import torchaudio
from speechbrain.inference.enhancement import SpectralMaskEnhancement

def test_speechbrain():
    print("Loading SpeechBrain model...")
    model = SpectralMaskEnhancement.from_hparams(
        source="speechbrain/metricgan-plus-voicebank",
        savedir="pretrained_models/metricgan-plus-voicebank",
        run_opts={"device": "cpu"}
    )
    
    print("Loading test audio...")
    audio_path = '../2026_f1_audio/NOR_1_20260704_123144.mp3'
    waveform, sr = torchaudio.load(audio_path)
    
    # Resample to 16000 if needed (MetricGAN+ requires 16000)
    if sr != 16000:
        print(f"Resampling from {sr} to 16000...")
        import torchaudio.transforms as T
        resampler = T.Resample(sr, 16000, dtype=waveform.dtype)
        waveform = resampler(waveform)
    
    print("Running enhancement...")
    # Add batch dimension if it's [channels, time]. MetricGAN+ expects [batch, time]
    # torchaudio loads as [channels, time]. If stereo, mean to mono.
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
        
    enhanced = model.enhance_batch(waveform, lengths=torch.tensor([1.]))
    
    print(f"Enhanced shape: {enhanced.shape}")
    print("Success!")

if __name__ == "__main__":
    test_speechbrain()
