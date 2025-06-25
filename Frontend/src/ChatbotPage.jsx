"use client"

import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"

function ChatbotPage() {
  const [messages, setMessages] = useState([{ text: "Hello! How can I help you today?", isBot: true }])
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim()) return

    // Add user message
    const newMessages = [...messages, { text: inputText, isBot: false }]
    setMessages(newMessages)
    setInputText("")
    setLoading(true)

    try {
      // Send request to Flask backend
      const response = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: inputText + "\n Give me shortest possible answer" }),
      })

      const data = await response.json()
      setLoading(false)

      if (response.ok) {
        setMessages([...newMessages, { text: data.response, isBot: true }])
      } else {
        setMessages([...newMessages, { text: "Error: Could not get a response", isBot: true }])
      }
    } catch (error) {
      console.error("Error:", error)
      setMessages([...newMessages, { text: "Error: Server not reachable", isBot: true }])
      setLoading(false)
    }
  }

  // Go back to call page
  const goBackToCall = () => {
    navigate("/")
  }

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2>AI Chatbot</h2>
        <button
          onClick={goBackToCall}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            backgroundColor: "#555",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Back to Call
        </button>
      </header>

      <div
        style={{
          flex: 1,
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "15px",
          overflowY: "auto",
          marginBottom: "20px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent: msg.isBot ? "flex-start" : "flex-end",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                maxWidth: "70%",
                padding: "10px 15px",
                borderRadius: "18px",
                backgroundColor: msg.isBot ? "#e1e1e1" : "#0084ff",
                color: msg.isBot ? "#333" : "white",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                maxWidth: "70%",
                padding: "10px 15px",
                borderRadius: "18px",
                backgroundColor: "#e1e1e1",
                color: "#333",
              }}
            >
              Typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: "12px 15px",
            borderRadius: "25px",
            border: "1px solid #ddd",
            fontSize: "16px",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "12px 20px",
            backgroundColor: "#0084ff",
            color: "white",
            border: "none",
            borderRadius: "25px",
            cursor: "pointer",
            fontSize: "16px",
          }}
          disabled={loading}
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
  )
}

export default ChatbotPage
