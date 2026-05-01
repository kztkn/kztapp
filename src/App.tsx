import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import MashGame from './pages/MashGame'
import GymTracker from './pages/GymTracker'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mash" element={<MashGame />} />
        <Route path="/gym" element={<GymTracker />} />
      </Routes>
    </BrowserRouter>
  )
}
