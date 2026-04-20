export default function KarmaModal({ strangerUsername, strangerUserId, socket, onRate }) {

    function handleRate(rating) {
        // Send rating to server (null = skipped)
        if (rating && socket && strangerUserId) {
            socket.emit('rateUser', { to: strangerUserId, rating })
        }
        onRate(rating)
    }

    return (
        <div id="karmaOverlay">
            <div id="karmaModal">
                <h3 id="karma-title">How was your conversation?</h3>
                <p id="karma-subtitle">
                    Anonymous — {strangerUsername || 'they'} won't know your rating
                </p>

                <div id="karma-buttons">
                    <button
                        className="karma-btn karma-great"
                        onClick={() => handleRate('great')}
                    >
                        <span className="karma-emoji">😊</span>
                        <span className="karma-label">Great</span>
                    </button>

                    <button
                        className="karma-btn karma-okay"
                        onClick={() => handleRate('okay')}
                    >
                        <span className="karma-emoji">😐</span>
                        <span className="karma-label">Okay</span>
                    </button>

                    <button
                        className="karma-btn karma-bad"
                        onClick={() => handleRate('disrespectful')}
                    >
                        <span className="karma-emoji">😠</span>
                        <span className="karma-label">Report</span>
                    </button>
                </div>

                <button id="karma-skip" onClick={() => handleRate(null)}>
                    Skip
                </button>
            </div>
        </div>
    )
}
