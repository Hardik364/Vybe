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
            className="prompt-icon-btn"
          >
            🔀
          </button>
          <button
            onClick={onClose}
            title="Dismiss"
            className="prompt-icon-btn prompt-icon-btn--close"
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
