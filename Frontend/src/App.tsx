import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import ZegoCall from "./ZegoCall"
import ChatbotPage from "./ChatbotPage"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ZegoCall />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
      </Routes>
    </Router>
  )
}

export default App
