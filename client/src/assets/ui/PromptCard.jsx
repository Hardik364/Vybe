// PromptCard — server-driven, both users see identical prompt

const CATEGORY_EMOJIS = {
    'Light & Fun':       '🌟',
    'Deep & Meaningful': '💜',
    'Debate & Opinion':  '🎯',
    'Nostalgic':         '🌸',
    'Dreams & Future':   '🚀',
}

export default function PromptCard({ prompt, onNext, onClose }) {
    const emoji = CATEGORY_EMOJIS[prompt.category] ?? '💬'

    return (
        <div id="promptCard" key={prompt.id}>
            <div id="prompt-label">
                {emoji} {prompt.category}
            </div>
            <p id="prompt-text">"{prompt.text}"</p>
            <div id="prompt-actions">
                <button
                    id="prompt-next-btn"
                    onClick={onNext}
                    title="Get a new prompt (both of you)"
                >
                    🔄 New prompt
                </button>
                <button
                    id="prompt-close-btn"
                    onClick={onClose}
                    title="Close for both of you"
                >
                    ✕ Close
                </button>
            </div>
        </div>
    )
}
