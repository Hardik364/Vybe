// Phase 2: fully server-driven — prompt comes from props, not local state.
// Server ensures both users always see the identical prompt.

const CATEGORY_STYLES = {
    'Light & Fun':       { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  emoji: '🌟' },
    'Deep & Meaningful': { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', emoji: '💜' },
    'Debate & Opinion':  { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)',  emoji: '🎯' },
    'Nostalgic':         { color: '#F472B6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)', emoji: '🌸' },
    'Dreams & Future':   { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  emoji: '🚀' },
}

export default function PromptCard({ prompt, onNext, onClose }) {
    const style = CATEGORY_STYLES[prompt.category] ?? CATEGORY_STYLES['Light & Fun']

    return (
        // key=prompt.id forces remount on every new prompt → re-triggers CSS slide-in animation
        <div id="promptCard" key={prompt.id}>
            <div id="promptCard-header">
                <span
                    className="category-badge"
                    style={{
                        color:      style.color,
                        background: style.bg,
                        border:     `1px solid ${style.border}`,
                    }}
                >
                    {style.emoji} {prompt.category}
                </span>

                <div id="promptCard-actions">
                    <button
                        className="prompt-icon-btn"
                        onClick={onNext}
                        title="New prompt (both of you get the same new one)"
                    >
                        🔄
                    </button>
                    <button
                        className="prompt-icon-btn close-btn"
                        onClick={onClose}
                        title="Close for both of you"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <p id="promptCard-text">"{prompt.text}"</p>
        </div>
    )
}
