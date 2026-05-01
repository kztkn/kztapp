import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, RotateCcw, Home, Trophy, Star, ThumbsUp } from 'lucide-react'

type Phase = 'ready' | 'playing' | 'result'

const DURATION = 5
const RESULT_LOCK = 2

export default function MashGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('ready')
  const [count, setCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION * 1000)
  const [lockRemaining, setLockRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const start = useCallback(() => {
    setCount(0)
    setTimeLeft(DURATION * 1000)
    startTimeRef.current = Date.now()
    setPhase('playing')
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setInterval(() => {
      const remaining = DURATION * 1000 - (Date.now() - startTimeRef.current)
      if (remaining <= 0) {
        clearInterval(timerRef.current!)
        setTimeLeft(0)
        setPhase('result')
      } else {
        setTimeLeft(remaining)
      }
    }, 50)
    return () => clearInterval(timerRef.current!)
  }, [phase])

  useEffect(() => {
    if (phase !== 'result') return
    setLockRemaining(RESULT_LOCK)
    const interval = setInterval(() => {
      setLockRemaining((r) => {
        if (r <= 1) { clearInterval(interval); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  const handleMash = (e: React.PointerEvent) => {
    e.preventDefault()
    if (phase === 'playing') setCount((c) => c + 1)
  }

  const rating = (n: number) => {
    if (n >= 40) return { label: '神業！', color: 'text-yellow-400', Icon: Trophy }
    if (n >= 30) return { label: 'すごい！', color: 'text-violet-400', Icon: Star }
    if (n >= 20) return { label: 'いい感じ', color: 'text-sky-400', Icon: ThumbsUp }
    return { label: 'もう一回！', color: 'text-gray-400', Icon: RotateCcw }
  }

  const resultLocked = lockRemaining > 0
  const displayTime = (timeLeft / 1000).toFixed(2)
  const timerColor =
    timeLeft > 3000 ? 'text-white' : timeLeft > 1000 ? 'text-yellow-400' : 'text-red-400'
  const r = rating(count)
  const RatingIcon = r.Icon

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white select-none overflow-hidden">
      {/* ヘッダー */}
      <header className="flex items-center gap-3 px-4 pt-5 pb-3 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-1 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-lg tracking-tight">連打ゲーム</h2>
      </header>

      {/* 中央コンテンツ — 位置が変わらないよう flex-1 で可変 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6 min-h-0">

        {phase === 'ready' && (
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Zap size={40} className="text-violet-400" strokeWidth={2} />
            </div>
            <p className="text-gray-400 text-base">{DURATION}秒間、全力で連打しよう！</p>
          </div>
        )}

        {phase === 'playing' && (
          <div className="w-full flex flex-col items-center gap-5">
            {/* タイマー */}
            <div className="text-center">
              <div className={`text-7xl font-black font-mono tabular-nums leading-none transition-colors duration-200 ${timerColor}`}>
                {displayTime}
              </div>
              <div className="text-gray-600 text-xs mt-2 tracking-widest uppercase">seconds</div>
            </div>

            {/* カウント — 固定高さで枠を安定させる */}
            <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 text-center">
              <div className="text-6xl font-black tabular-nums leading-none">{count}</div>
              <div className="text-gray-500 text-xs mt-2 tracking-widest uppercase">taps</div>
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="w-full text-center space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl py-6">
              <div className="text-7xl font-black tabular-nums leading-none">{count}</div>
              <div className="text-gray-500 text-xs mt-2 tracking-widest uppercase">
                taps in {DURATION}s
              </div>
            </div>

            <div className={`flex items-center justify-center gap-2 ${r.color}`}>
              <RatingIcon size={20} strokeWidth={2} />
              <span className="text-2xl font-bold">{r.label}</span>
            </div>

            {resultLocked && (
              <p className="text-gray-600 text-sm">
                あと{lockRemaining}秒でボタンが使えます…
              </p>
            )}
          </div>
        )}
      </div>

      {/* ボタンエリア — 常に画面下部固定 */}
      <div className="shrink-0 px-5 pb-10 pt-4 space-y-3">
        {phase === 'ready' && (
          <button
            onClick={start}
            className="w-full h-20 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-violet-500/25 active:scale-[0.97] transition-transform duration-100"
          >
            <Zap size={22} strokeWidth={2.5} />
            スタート
          </button>
        )}

        {phase === 'playing' && (
          <button
            onPointerDown={handleMash}
            style={{ touchAction: 'none' }}
            className="w-full h-36 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30 active:scale-[0.97] active:shadow-none transition-all duration-75 border border-violet-400/20"
          >
            <Zap size={52} className="text-white" strokeWidth={2} />
          </button>
        )}

        {phase === 'result' && (
          <>
            <button
              disabled={resultLocked}
              onClick={start}
              className="w-full h-14 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 active:scale-[0.97] transition-all duration-100 disabled:opacity-30 disabled:active:scale-100"
            >
              <RotateCcw size={17} strokeWidth={2.5} />
              もう一回
            </button>
            <button
              disabled={resultLocked}
              onClick={() => navigate('/')}
              className="w-full h-14 bg-gray-800 border border-gray-700 rounded-2xl font-bold text-gray-300 flex items-center justify-center gap-2 active:scale-[0.97] transition-all duration-100 disabled:opacity-30 disabled:active:scale-100"
            >
              <Home size={17} strokeWidth={2} />
              ホームへ
            </button>
          </>
        )}
      </div>
    </div>
  )
}
