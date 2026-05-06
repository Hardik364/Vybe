'use client'

export default function PromptCard({ prompt, onNext, onClose }) {
  return (
    <div className="prompt-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px',
          borderRadius: 'var(--r-full)', letterSpacing: '0.3px',
          color: '#fff', background: 'var(--accent)',
        }}>
          💭 {prompt.cat || 'Prompt'}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={onNext}
            title="Next prompt"
            style={{
              width: 28, height: 28, borderRadius: 'var(--r-xs)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'var(--t3)', background: 'none', border: 'none',
              cursor: 'pointer', transition: 'all var(--t-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elev)'; e.currentTarget.style.color = 'var(--t2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' }}
          >
            🔀
          </button>
          <button
            onClick={onClose}
            title="Dismiss"
            style={{
              width: 28, height: 28, borderRadius: 'var(--r-xs)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'var(--t3)', background: 'none', border: 'none',
              cursor: 'pointer', transition: 'all var(--t-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elev)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' }}
          >
            ✕
          </button>
        </div>
      </div>
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.6, fontStyle: 'italic' }}>
        "{prompt.text}"
      </p>
    </div>
  )
}
