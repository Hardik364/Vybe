import { useState } from "react"

export default function InputBox({ socket, setMessage, strangerUserId, username, onNewUser }) {
    const [messageInputValue, setMessageInputValue] = useState('')

    function sendMessage(e) {
        e.preventDefault()
        if (!messageInputValue.trim()) return
        socket.emit("private message", {
            content: {
                username: username,
                message: messageInputValue,
                userid: socket.id
            },
            to: strangerUserId
        })
        setMessage(prevMessages => [...prevMessages, {
            username: username,
            message: messageInputValue,
        }])
        setMessageInputValue("")
    }

    function handleNewUser(e) {
        e.preventDefault()
        if (onNewUser) onNewUser()
    }

    return (
        <div id="inputBar">
            <button id="changeNewUser" type="button" onClick={handleNewUser} title="Find new stranger">
                New ↩
            </button>
            <form onSubmit={sendMessage} id="sendMassage">
                <input
                    type="text"
                    name="sendMessage"
                    id="sendMessageBox"
                    value={messageInputValue}
                    placeholder="Type a message..."
                    onChange={(e) => setMessageInputValue(e.target.value)}
                />
                <button type="submit" id="sendBtn" title="Send">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </form>
        </div>
    )
}
