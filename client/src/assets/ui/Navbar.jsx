import { useNavigate } from 'react-router-dom'

export default function Navbar({ strangerUsername, connectionStatus, promptActive, onPromptClick, liveCount, setUsername }) {
    const navigate = useNavigate()

    function handleLogout() {
        localStorage.removeItem('rt_token')
        if (setUsername) setUsername(null)
        navigate('/')
    }

    return (
        <nav id="navbar">
            <div id="nav-logo">
                <span id="nav-logo-spark">✦</span>
                RealTalk
            </div>

            <div id="nav-center">
                {connectionStatus ? (
                    <div id="nav-stranger-info">
                        <span className="online-dot"></span>
                        <span id="nav-stranger-name">{strangerUsername}</span>
                    </div>
                ) : (
                    <div id="nav-searching">
                        <div id="nav-loader"></div>
                        <span>
                            {strangerUsername
                                ? 'Connecting...'
                                : liveCount > 0
                                    ? `${liveCount} ${liveCount === 1 ? 'person' : 'people'} waiting — finding your match...`
                                    : 'Finding your match...'}
                        </span>
                    </div>
                )}
            </div>

            <div id="nav-right">
                <button
                    id="promptBtn"
                    className={[
                        promptActive      ? 'active'   : '',
                        !connectionStatus ? 'disabled' : '',
                    ].join(' ').trim()}
                    onClick={connectionStatus ? onPromptClick : undefined}
                    title={connectionStatus ? 'Get a conversation prompt' : 'Connect with someone first'}
                    aria-disabled={!connectionStatus}
                >
                    🎲 Prompts
                </button>

                <button id="logoutBtn" onClick={handleLogout} title="Log out">
                    ⏏︎
                </button>
            </div>
        </nav>
    )
}
