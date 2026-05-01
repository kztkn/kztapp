import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import MashGame from './pages/MashGame'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mash" element={<MashGame />} />
      </Routes>
    </BrowserRouter>
  )
}
