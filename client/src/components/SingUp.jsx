import { useNavigate } from "react-router-dom"

export default function SingUp({ setUsername }) {
    const navigate = useNavigate()

    function usernameSubmit(e) {
        e.preventDefault()
        const value = e.target[0].value.trim()
        if (value) {
            setUsername(value)
            navigate("/chat")
        } else {
            const input = e.target[0]
            input.classList.add('input-error')
            setTimeout(() => input.classList.remove('input-error'), 600)
        }
    }

    return (
        <div id="signupPage">
            <div id="signup-glow"></div>

            <div id="signup-card">
                <div id="signup-logo">
                    <span id="signup-logo-spark">✦</span>
                    RealTalk
                </div>

                <p id="signup-tagline">
                    One stranger. Real talk. Your college.
                </p>

                <form onSubmit={usernameSubmit} id="signup-form">
                    <div id="signup-input-wrapper">
                        <span id="signup-input-icon">👤</span>
                        <input
                            type="text"
                            className="singupInputBox"
                            placeholder="What should we call you?"
                            autoFocus
                            maxLength={24}
                        />
                    </div>

                    <input
                        type="submit"
                        className="singupInputBox"
                        id="signupSubmitBtn"
                        value="Start Talking →"
                    />
                </form>

                <p id="signup-disclaimer">
                    Anonymous by default · No account needed
                </p>
            </div>
        </div>
    )
}
