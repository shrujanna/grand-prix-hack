import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_model = None

def get_denoiser_model():
    """Lazy load the denoiser model to save memory if unused and speed up initial startup."""
    global _model
    if _model is None:
        try:
            from speechbrain.inference.enhancement import SpectralMaskEnhancement
            logger.info("Loading SpeechBrain metricgan-plus-voicebank model... (this may take a moment)")
            # Load the SpeechBrain model
            _model = SpectralMaskEnhancement.from_hparams(
                source="speechbrain/metricgan-plus-voicebank",
                savedir="pretrained_models/metricgan-plus-voicebank",
                run_opts={"device": "cpu"}
            )
            logger.info("SpeechBrain Denoiser model loaded successfully.")
        except ImportError as e:
            logger.error(f"Failed to import SpeechBrain dependencies: {e}")
            raise RuntimeError("SpeechBrain is not installed properly.") from e
        except Exception as e:
            logger.error(f"Failed to load SpeechBrain model: {e}")
            raise
    return _model

def denoise_audio_bytes(audio_bytes: bytes) -> bytes:
    """
    Takes raw audio bytes, runs them through the SpeechBrain MetricGAN+ denoiser,
    and returns cleaned WAV audio bytes.
    """
    try:
        import torch
        import torchaudio
        import soundfile as sf
        
        model = get_denoiser_model()
        
        # Load audio using torchaudio
        waveform, sample_rate = torchaudio.load(io.BytesIO(audio_bytes))
        
        # MetricGAN+ requires 16000 Hz
        if sample_rate != 16000:
            import torchaudio.transforms as T
            resampler = T.Resample(sample_rate, 16000, dtype=waveform.dtype)
            waveform = resampler(waveform)
        
        # If stereo, mix down to mono for the model
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
            
        # Run enhancement
        with torch.no_grad():
            denoised_waveform = model.enhance_batch(waveform, lengths=torch.tensor([1.]))
            
        out_io = io.BytesIO()
        # Soundfile expects [frames, channels]
        sf.write(out_io, denoised_waveform.cpu().squeeze(0).numpy().T, 16000, format="WAV")
        return out_io.getvalue()
        
    except Exception as e:
        logger.exception("SpeechBrain Denoiser failed to process audio.")
        raise RuntimeError(f"Audio denoising failed: {e}") from e
