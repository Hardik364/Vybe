import { useRef, useEffect } from "react"

export default function MessagBox({ message, username, socket, setMessage, strangerUsername, strangerUserId, connectionStatus }) {
    const scrollMessageDiv = useRef(null)

    useEffect(() => {
        scrollMessageDiv.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, [message])

    useEffect(() => {
        if (socket) {
            socket.on("private message", ({ content, from }) => {
                if (strangerUserId === from) {
                    setMessage(prevMessages => [...prevMessages, content])
                }
            })
            return () => {
                socket.removeAllListeners("private message")
            }
        }
    }, [strangerUserId])

    return (
        <div id="messageBox">
            {message.length === 0 && (
                <div id="overlayStatus">
                    {connectionStatus ? (
                        <>
                            <span id="overlay-emoji">👋</span>
                            <p id="overlay-connected">You and <strong>{strangerUsername}</strong> are connected</p>
                            <p id="overlay-hint">Say hi, or use 🎲 Prompts to break the ice</p>
                        </>
                    ) : (
                        <>
                            <div id="overlay-search-ring"></div>
                            <p id="overlay-searching">Finding your match...</p>
                        </>
                    )}
                </div>
            )}

            {message.map((item, index) => (
                item ? (
                    <div className={item.username === username ? 'right' : 'left'} key={index}>
                        {item.message}
                    </div>
                ) : null
            ))}

            <div ref={scrollMessageDiv}></div>
        </div>
    )
}
