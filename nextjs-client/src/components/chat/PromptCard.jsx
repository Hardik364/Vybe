'use client'

export default function PromptCard({ prompt, onNext, onClose }) {
  return (
    <div
      className="mx-2.5 mt-2.5 shrink-0 rounded-md p-[12px_14px] border animate-slide-down"
      style={{
        background: 'linear-gradient(135deg,var(--accent-glow),oklch(64% 0.09 280 / 0.4))',
        borderColor: 'oklch(64% 0.22 280 / 0.35)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[11px] font-bold px-2.5 py-[3px] rounded-2xl tracking-[0.3px] text-white"
          style={{ background: 'var(--accent)' }}
        >
          💭 {prompt.cat || 'Prompt'}
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={onNext}
            className="w-7 h-7 rounded-xs flex items-center justify-center text-t3 text-[13px] transition-all hover:bg-elev hover:text-t2"
            title="Next prompt"
          >
            🔀
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xs flex items-center justify-center text-t3 text-[13px] transition-all hover:bg-elev hover:text-red"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
      <p className="text-[14px] font-medium text-t1 leading-[1.6] italic">
        "{prompt.text}"
      </p>
    </div>
  )
}
