import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AudioPlayback } from './AudioPlayback'


describe('AudioPlayback', () => {
  it('provides standard playback and speed controls for a radio clip', () => {
    const { container } = render(<AudioPlayback audioUrl="/media/radio.mp3" transcript="Box, box this lap." />)

    const audio = container.querySelector('audio')
    expect(audio).toHaveAttribute('controls')
    expect(audio).toHaveAttribute('src', 'http://127.0.0.1:8000/media/radio.mp3')

    const speed = screen.getByLabelText('Playback speed')
    fireEvent.change(speed, { target: { value: '1.5' } })
    expect(speed).toHaveValue('1.5')
  })
})
