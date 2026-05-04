import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import MashGame from './pages/MashGame'
import Klask from './pages/Klask'
import KlaskGame from './pages/KlaskGame'
import StickRunGame from './pages/StickRunGame'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mash" element={<MashGame />} />
        <Route path="/klask" element={<Klask />} />
        <Route path="/klask/game" element={<KlaskGame />} />
        <Route path="/run" element={<StickRunGame />} />
      </Routes>
    </BrowserRouter>
  )
}
