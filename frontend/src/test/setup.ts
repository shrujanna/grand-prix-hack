import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:radio-clip') })
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn() })
