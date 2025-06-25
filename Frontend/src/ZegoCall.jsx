"use client"

import { useState, useRef, useEffect } from "react"
import { ZegoExpressEngine } from "zego-express-engine-webrtc"

const APP_ID = "appID"
const APP_SIGN = "appSign"
const ROOM_ID = "TestRoom"
const USER_ID = "userID"


function ZegoCall() {
  const [isCallActive, setIsCallActive] = useState(false)
  const [recognizedText, setRecognizedText] = useState("")
  const [status, setStatus] = useState("Ready")
  const [responseText, setResponseText] = useState(""); // Stores the response for display
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const zegoClient = useRef(null)
  const recognitionRef = useRef(null)
  const isSpeaking = useRef(false)

  // Initializes speech recognition
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser")
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onstart = () => {
      console.log("Speech recognition started")
      setStatus("Listening...")
    }

    recognition.onresult = async (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log("[Frontend] Recognized:", transcript);
      setRecognizedText(transcript);
      setStatus(`Processing: "${transcript}"`);
    
      try {
        // Changed: Single API call to speech-chat endpoint
        const response = await fetch("http://127.0.0.1:5000/speech-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: transcript })
        });
    
        const data = await response.json();
        console.log("[Backend Response]", data);
    
        // New: Store and speak the response
        if (data.tts_response) {
          setResponseText(data.tts_response); // Update state for UI
          setStatus("Speaking response...");
          respondWithMessage(data.tts_response); // Text-to-speech
        } else {
          throw new Error("No TTS response received");
        }
    
      } catch (error) {
        console.error("Backend error:", error);
        setStatus(`Error: ${error.message}`);
        respondWithMessage("Sorry, I couldn't process that request."); // Fallback
      }
    };

    recognition.onerror = (event) => {
      console.error("Recognition error:", event.error)
      setStatus(`Error: ${event.error}`)
      if (event.error !== "no-speech") {
        setTimeout(() => recognition.start(), 1000)
      }
    }

    recognition.onend = () => {
      if (isCallActive) {
        recognition.start()
      }
    }

    return recognition
  }

  const respondWithMessage = (message) => { // Now takes parameter
    if (isSpeaking.current) return;
    isSpeaking.current = true;
    
    const utterance = new SpeechSynthesisUtterance(message); // Uses dynamic message
    utterance.onend = () => {
      isSpeaking.current = false;
      setStatus("Listening...");
    };
    
    window.speechSynthesis.speak(utterance);
  };
  const startCall = async () => {
    try {
      setStatus("Initializing call...")
      const TOKEN="ZegoCallToken"

      // Initialize Zego engine
      zegoClient.current = new ZegoExpressEngine(APP_ID, APP_SIGN)

      // Login to room
      await zegoClient.current.loginRoom(ROOM_ID, TOKEN, { userID: USER_ID, userName: USER_ID }, { userUpdate: true })

      // Create and publish stream
      const localStream = await zegoClient.current.createStream({
        camera: { audio: true, video: false },
      })
      await zegoClient.current.startPublishingStream(`stream_${USER_ID}`, localStream)

      // Initialize speech recognition
      recognitionRef.current = initSpeechRecognition()
      if (recognitionRef.current) {
        recognitionRef.current.start()
      }

      setIsCallActive(true)
      setStatus("Call active - speak now")
    } catch (error) {
      console.error("Call error:", error)
      setStatus(`Error: ${error.message}`)
    }
  }

  const endCall = async () => {
    setStatus("Ending call...")
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }

      if (zegoClient.current) {
        await zegoClient.current.stopPublishingStream(`stream_${USER_ID}`)
        await zegoClient.current.logoutRoom(ROOM_ID)
        zegoClient.current.destroyEngine()
        zegoClient.current = null
      }

      setIsCallActive(false)
      setRecognizedText("")
      setStatus("Call ended")
    } catch (error) {
      console.error("Error ending call:", error)
      setStatus(`Error ending call: ${error.message}`)
    }
  }

  // Toggle chatbot visibility
  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen)
  }

  // Clean up
  useEffect(() => {
    return () => {
      if (isCallActive) {
        endCall()
      }
    }
  }, [])

  return (
    <div style={{ textAlign: "center", padding: "20px", position: "relative" }}>
      <h2>Virtual Telecaller</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
        <button
          onClick={isCallActive ? endCall : startCall}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: isCallActive ? "red" : "green",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            margin: "10px",
          }}
        >
          {isCallActive ? "End Call" : "Start Call"}
        </button>

        <button
          onClick={toggleChatbot}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#0084ff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            margin: "10px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span>{isChatbotOpen ? "Close Chatbot" : "Open Chatbot"}</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      </div>

      <div style={{ margin: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "5px" }}>
        <h3>Status: {status}</h3>
        <p>
          <strong>Recognized Speech:</strong> {recognizedText || "Nothing yet..."}
        </p>
        <p>
        <strong>Response:</strong> {responseText || "Waiting for response..."}
      </p>
      </div>

      {/* Chatbot Popup */}
      {isChatbotOpen && <ChatbotPopup onClose={toggleChatbot} />}
    </div>
  )
}

// Chatbot Popup Component (unchanged)
function ChatbotPopup({ onClose }) {
  const [messages, setMessages] = useState([{ text: "Hello! How can I help you today?", isBot: true }])
  const [inputText, setInputText] = useState("")
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle sending a message
  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!inputText.trim()) return

    // Add user message
    const newMessages = [...messages, { text: inputText, isBot: false }]
    setMessages(newMessages)
    setInputText("")

    // Simulate bot response after a short delay
    setTimeout(async () => {
      const botResponse = await getBotResponse(inputText);
      setMessages((prevMessages) => [...prevMessages, { text: botResponse, isBot: true }]);
    }, 1000);
  }

  // Simple bot response logic
  const getBotResponse = async (text) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });
  
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error("Error:", error);
      return "Error contacting the chatbot.";
    }
  };
  
  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        width: "350px",
        height: "500px",
        backgroundColor: "white",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      {/* Chatbot Header */}
      <div
        style={{
          padding: "15px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#0084ff",
          color: "white",
          borderTopLeftRadius: "10px",
          borderTopRightRadius: "10px",
        }}
      >
        <h3 style={{ margin: 0 }}>AI Chatbot</h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "white",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      {/* Messages Container */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "15px",
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
                maxWidth: "80%",
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        style={{
          display: "flex",
          padding: "10px",
          borderTop: "1px solid #eee",
          backgroundColor: "white",
          borderBottomLeftRadius: "10px",
          borderBottomRightRadius: "10px",
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "20px",
            marginRight: "10px",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px",
            backgroundColor: "#0084ff",
            color: "white",
            border: "none",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  )
}

export default ZegoCall


