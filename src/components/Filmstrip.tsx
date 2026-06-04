import { useState } from 'react'
import type { Frame } from '../types'

interface Props {
  frames: Frame[]
  activeIndex: number | null
  onSelect: (index: number) => void
  onDelete: (index: number) => void
  onReorder: (from: number, to: number) => void
}

export function Filmstrip({ frames, activeIndex, onSelect, onDelete, onReorder }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function reset() {
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="border-t border-white/10 bg-black/30 px-3 py-3">
      {frames.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-sm text-white/30">
          No frames yet — hit <span className="mx-1 font-medium text-white/50">Capture</span> to shoot your first one.
        </div>
      ) : (
        <div className="flex h-[120px] items-center gap-2 overflow-x-auto">
          {frames.map((frame, i) => {
            const isDragging = dragIndex === i
            const isDropTarget = overIndex === i && dragIndex !== null && dragIndex !== i
            return (
              <div
                key={frame.id}
                draggable
                onDragStart={(e) => {
                  setDragIndex(i)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(i))
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (overIndex !== i) setOverIndex(i)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i)
                  reset()
                }}
                onDragEnd={reset}
                className={`group relative shrink-0 cursor-grab overflow-hidden rounded-md ring-2 transition active:cursor-grabbing ${
                  isDropTarget
                    ? 'ring-amber-400'
                    : activeIndex === i
                      ? 'ring-amber-400/70'
                      : 'ring-transparent hover:ring-white/30'
                } ${isDragging ? 'opacity-40' : ''}`}
                onClick={() => onSelect(i)}
              >
                {isDropTarget && <span className="absolute inset-y-0 left-0 z-10 w-1 bg-amber-400" />}
                <img src={frame.thumb} alt={`Frame ${i + 1}`} className="h-[108px] w-auto" draggable={false} />
                <span className="absolute bottom-0 left-0 bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(i)
                  }}
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white/90 hover:bg-red-500 group-hover:flex"
                  aria-label={`Delete frame ${i + 1}`}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
