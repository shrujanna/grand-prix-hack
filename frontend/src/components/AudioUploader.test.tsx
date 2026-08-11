import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioUploader, type AnalysisResult } from './AudioUploader'


const successfulAnalysis: AnalysisResult = {
  transcript: 'I cannot find grip.',
  audio_model_label: 'frustrated',
  audio_model_confidence: 0.84,
  text_model_label: 'frustrated',
  text_model_intensity: 4,
  transcription_status: 'completed',
  audio_analysis_status: 'completed',
  text_analysis_status: 'completed',
}

const failedAudioAnalysis: AnalysisResult = {
  ...successfulAnalysis,
  audio_model_label: 'unknown',
  audio_model_confidence: 0,
  audio_analysis_status: 'unavailable',
  audio_analysis_error: 'The analysis provider is temporarily unavailable. Please retry.',
}

const response = (body: AnalysisResult) => ({
  ok: true,
  json: async () => body,
})

const upload = () => {
  const file = new File(['race radio'], 'radio.mp3', { type: 'audio/mpeg' })
  fireEvent.change(screen.getByLabelText('audio-file-input'), { target: { files: [file] } })
}

describe('AudioUploader', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows individual analysis states after an upload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(successfulAnalysis)))
    render(<AudioUploader onAnalysisComplete={vi.fn()} onError={vi.fn()} />)

    upload()

    expect(await screen.findByText('Speech to text')).toBeInTheDocument()
    expect(screen.getAllByText('completed')).toHaveLength(3)
  })

  it('rejects an invalid upload before sending it to the API', async () => {
    const onError = vi.fn()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AudioUploader onAnalysisComplete={vi.fn()} onError={onError} />)

    const file = new File(['not audio'], 'radio.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('audio-file-input'), { target: { files: [file] } })

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Please upload a supported audio file.'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries only the failed service', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(failedAudioAnalysis))
      .mockResolvedValueOnce(response(successfulAnalysis))
    vi.stubGlobal('fetch', fetchMock)
    render(<AudioUploader onAnalysisComplete={vi.fn()} onError={vi.fn()} />)

    upload()
    fireEvent.click(await screen.findByRole('button', { name: 'RETRY FAILED ANALYSIS' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const retryForm = fetchMock.mock.calls[1][1].body as FormData
    expect(retryForm.get('retry_services')).toBe('audio')
    expect(retryForm.get('transcript')).toBe('I cannot find grip.')
  })
})
