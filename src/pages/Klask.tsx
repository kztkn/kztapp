import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check } from 'lucide-react'

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

export default function Klask() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'select' | 'host' | 'join'>('select')
  const [joinCode, setJoinCode] = useState('')
  const [hostCode] = useState(() => generateCode())
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hostCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startAsHost = () => {
    navigate(`/klask/game?room=${hostCode}&role=host`)
  }

  const startAsGuest = () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length === 4) {
      navigate(`/klask/game?room=${code}&role=guest`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          onClick={() => (mode === 'select' ? navigate('/') : setMode('select'))}
          className="p-2 -ml-1 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-lg tracking-tight">クラスク</h2>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {mode === 'select' && (
          <>
            <div className="text-center space-y-3">
              <div className="w-24 h-24 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-5xl">
                🏒
              </div>
              <p className="text-gray-400 text-sm">友達と1:1で対戦しよう！</p>
              <p className="text-gray-600 text-xs">先に5点取ったら勝ち</p>
            </div>

            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => setMode('host')}
                className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl font-bold text-lg active:scale-[0.97] transition-transform shadow-lg shadow-emerald-500/20"
              >
                ルームを作る
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full h-14 bg-gray-800 border border-gray-700 rounded-2xl font-bold text-gray-300 active:scale-[0.97] transition-transform"
              >
                ルームに入る
              </button>
            </div>
          </>
        )}

        {mode === 'host' && (
          <div className="w-full max-w-xs space-y-6">
            <div className="text-center space-y-2">
              <p className="text-gray-400 text-sm">このコードを友達に教えよう</p>
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 flex items-center justify-between">
                <span className="text-5xl font-black tracking-widest text-emerald-400 font-mono">
                  {hostCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  {copied ? (
                    <Check size={20} className="text-emerald-400" />
                  ) : (
                    <Copy size={20} />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={startAsHost}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl font-bold active:scale-[0.97] transition-transform"
            >
              ゲーム画面へ進む
            </button>
            <p className="text-center text-gray-600 text-xs">
              ゲーム画面でスタートボタンを押すと開始します
            </p>
          </div>
        )}

        {mode === 'join' && (
          <div className="w-full max-w-xs space-y-6">
            <div className="text-center space-y-3">
              <p className="text-gray-400 text-sm">4桁のコードを入力</p>
              <input
                type="text"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-4 text-center text-4xl font-black tracking-widest text-emerald-400 uppercase outline-none focus:border-emerald-500 font-mono transition-colors"
              />
            </div>
            <button
              onClick={startAsGuest}
              disabled={joinCode.trim().length !== 4}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl font-bold active:scale-[0.97] transition-transform disabled:opacity-30 disabled:active:scale-100"
            >
              参加する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
