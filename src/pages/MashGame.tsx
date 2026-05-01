import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

type Phase = 'ready' | 'playing' | 'result'

const DURATION = 10

export default function MashGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('ready')
  const [count, setCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    setCount(0)
    setTimeLeft(DURATION)
    setPhase('playing')
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          setPhase('result')
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current!)
  }, [phase])

  const handleMash = () => {
    if (phase === 'playing') setCount((c) => c + 1)
  }

  const rating = (n: number) => {
    if (n >= 80) return { label: '神業！', color: 'text-yellow-400' }
    if (n >= 60) return { label: 'すごい！', color: 'text-violet-400' }
    if (n >= 40) return { label: 'いい感じ', color: 'text-blue-400' }
    return { label: 'もう一回！', color: 'text-gray-400' }
  }

  const r = rating(count)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-sm space-y-8 text-center">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
        >
          ← もどる
        </button>

        <h2 className="text-2xl font-bold">連打ゲーム</h2>

        {phase === 'ready' && (
          <div className="space-y-6">
            <p className="text-gray-400">{DURATION}秒で何回押せるか挑戦！</p>
            <button
              onClick={start}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl py-5 text-xl font-bold shadow-lg shadow-violet-500/30 active:scale-95 transition-transform duration-100"
            >
              スタート
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="space-y-6">
            <div className="relative">
              <div className="text-7xl font-black tabular-nums">{count}</div>
              <div className="text-gray-400 mt-1">回</div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <div className={`h-2 rounded-full bg-violet-500 transition-all duration-1000`}
                style={{ width: `${(timeLeft / DURATION) * 100}%`, maxWidth: '200px' }} />
              <span className="text-gray-300 font-mono tabular-nums w-6">{timeLeft}</span>
            </div>

            <button
              onClick={handleMash}
              className="w-full h-40 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl text-5xl shadow-xl shadow-violet-500/40 active:scale-95 active:shadow-none transition-all duration-75"
            >
              👆
            </button>
          </div>
        )}

        {phase === 'result' && (
          <div className="space-y-6">
            <div>
              <div className="text-7xl font-black tabular-nums">{count}</div>
              <div className="text-gray-400 mt-1">回 / {DURATION}秒</div>
            </div>

            <p className={`text-2xl font-bold ${r.color}`}>{r.label}</p>

            <div className="space-y-3">
              <button
                onClick={start}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl py-4 font-bold shadow-lg shadow-violet-500/30 active:scale-95 transition-transform duration-100"
              >
                もう一回
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-gray-800 rounded-2xl py-4 font-bold text-gray-300 active:scale-95 transition-transform duration-100"
              >
                ホームへ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
