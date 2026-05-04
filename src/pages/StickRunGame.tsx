import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Home } from 'lucide-react'

type Phase = 'ready' | 'playing' | 'dead'

const CW = 375
const CH = 220
const GROUND = CH - 40
const JUMP_VY = -10
const GRAVITY = 0.50
const STICK_X = 70
const HIT_W = 7
const HIT_H = 68

interface Obstacle {
  x: number
  w: number
  h: number
}

interface GS {
  vy: number
  footY: number
  jumping: boolean
  frame: number
  score: number
  obstacles: Obstacle[]
  nextObstacle: number
  speed: number
  alive: boolean
}

function mkGS(): GS {
  return {
    vy: 0, footY: GROUND, jumping: false, frame: 0, score: 0,
    obstacles: [], nextObstacle: 90, speed: 4.0, alive: true,
  }
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  footY: number,
  frame: number,
  jumping: boolean,
) {
  const t = frame * 0.18
  const hipY = footY - 28
  const shoulderY = hipY - 24
  const headY = shoulderY - 12

  ctx.save()
  ctx.strokeStyle = '#c4b5fd'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Head
  ctx.beginPath()
  ctx.arc(x, headY, 11, 0, Math.PI * 2)
  ctx.stroke()

  // Body
  ctx.beginPath()
  ctx.moveTo(x, shoulderY)
  ctx.lineTo(x, hipY)
  ctx.stroke()

  const legSw = jumping ? 0.3 : Math.sin(t) * 0.65
  const armSw = jumping ? -0.4 : Math.sin(t) * 0.45

  // Right leg / left leg (alternating)
  ctx.beginPath()
  ctx.moveTo(x, hipY)
  ctx.lineTo(x + Math.sin(legSw) * 26, hipY + Math.cos(Math.abs(legSw)) * 26)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, hipY)
  ctx.lineTo(x - Math.sin(legSw) * 26, hipY + Math.cos(Math.abs(legSw)) * 26)
  ctx.stroke()

  // Right arm / left arm (opposite phase to legs)
  ctx.beginPath()
  ctx.moveTo(x, shoulderY)
  ctx.lineTo(x - Math.sin(armSw) * 18, shoulderY + 11)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, shoulderY)
  ctx.lineTo(x + Math.sin(armSw) * 18, shoulderY + 11)
  ctx.stroke()

  ctx.restore()
}

function drawScene(ctx: CanvasRenderingContext2D, s: GS, phase: Phase) {
  ctx.clearRect(0, 0, CW, CH)
  ctx.fillStyle = '#030712'
  ctx.fillRect(0, 0, CW, CH)

  // Ground line
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(0, GROUND)
  ctx.lineTo(CW, GROUND)
  ctx.stroke()

  // Obstacles
  for (const ob of s.obstacles) {
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(ob.x, GROUND - ob.h, ob.w, ob.h)
  }

  // Stick figure
  drawFigure(ctx, STICK_X, s.footY, s.frame, s.jumping)

  // Red overlay on death
  if (phase === 'dead') {
    ctx.fillStyle = 'rgba(239,68,68,0.15)'
    ctx.fillRect(0, 0, CW, CH)
  }
}

export default function StickRunGame() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const gsRef = useRef<GS>(mkGS())
  const phaseRef = useRef<Phase>('ready')
  const bestRef = useRef(0)
  const rafRef = useRef(0)

  const doJump = useCallback(() => {
    const s = gsRef.current
    if (s.alive && !s.jumping) {
      s.vy = JUMP_VY
      s.jumping = true
    }
  }, [])

  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    gsRef.current = mkGS()
    phaseRef.current = 'playing'
    setScore(0)
    setIsNewBest(false)
    setPhase('playing')
  }, [])

  // Static draw for ready / dead screens
  useEffect(() => {
    if (phase === 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    drawScene(ctx, gsRef.current, phase)
  }, [phase])

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function tick() {
      const s = gsRef.current

      // Physics
      s.vy += GRAVITY
      s.footY += s.vy
      if (s.footY >= GROUND) {
        s.footY = GROUND
        s.vy = 0
        s.jumping = false
      }

      // Spawn obstacles
      s.nextObstacle--
      if (s.nextObstacle <= 0) {
        const h = 28 + Math.random() * 28
        const w = 18 + Math.random() * 12
        s.obstacles.push({ x: CW + 10, w, h })
        s.nextObstacle = Math.max(42, 90 - Math.floor(s.score / 8))
      }

      for (const ob of s.obstacles) ob.x -= s.speed
      s.obstacles = s.obstacles.filter(ob => ob.x + ob.w > 0)

      s.speed = 4.0 + s.score * 0.05
      s.frame++
      if (s.frame % 6 === 0) {
        s.score++
        setScore(s.score)
      }

      // Collision (body only, ignoring swinging limbs)
      const fX1 = STICK_X - HIT_W
      const fX2 = STICK_X + HIT_W
      const fY1 = s.footY - HIT_H
      const fY2 = s.footY

      for (const ob of s.obstacles) {
        if (fX2 > ob.x && fX1 < ob.x + ob.w && fY2 > GROUND - ob.h && fY1 < GROUND) {
          s.alive = false
          const newBest = s.score > bestRef.current
          bestRef.current = Math.max(bestRef.current, s.score)
          setBest(bestRef.current)
          setIsNewBest(newBest)
          drawScene(ctx, s, 'dead')
          phaseRef.current = 'dead'
          setPhase('dead')
          return
        }
      }

      drawScene(ctx, s, 'playing')
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  // Keyboard (Space / ArrowUp)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (phaseRef.current === 'playing') doJump()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doJump])

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white select-none overflow-hidden">
      <header className="flex items-center gap-3 px-4 pt-5 pb-3 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-1 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-lg tracking-tight">棒人間ランナー</h2>
        <div className="ml-auto flex items-baseline gap-2">
          <span className="text-2xl font-black tabular-nums">{score}</span>
          <span className="text-xs text-gray-500">m</span>
          {best > 0 && <span className="text-xs text-gray-600">/ {best}</span>}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4 min-h-0">
        <div className="w-full max-w-sm">
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            className="w-full rounded-2xl border border-gray-800"
          />
        </div>

        {phase === 'ready' && (
          <p className="text-gray-500 text-sm text-center">
            障害物を飛び越えて走り続けよう！
          </p>
        )}

        {phase === 'dead' && (
          <div className="text-center space-y-1">
            <p className="text-red-400 font-bold text-lg">ゲームオーバー</p>
            {isNewBest && (
              <p className="text-yellow-400 text-sm font-semibold">自己ベスト更新！</p>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 pb-10 pt-3 space-y-3">
        {phase === 'ready' && (
          <button
            onClick={startGame}
            className="w-full h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl text-xl font-bold shadow-lg shadow-orange-500/25 active:scale-[0.97] transition-transform duration-100"
          >
            スタート
          </button>
        )}

        {phase === 'playing' && (
          <button
            onPointerDown={(e) => { e.preventDefault(); doJump() }}
            style={{ touchAction: 'none' }}
            className="w-full h-28 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl text-2xl font-bold flex items-center justify-center shadow-xl shadow-orange-500/30 active:scale-[0.97] active:shadow-none transition-all duration-75 border border-orange-400/20"
          >
            ジャンプ！
          </button>
        )}

        {phase === 'dead' && (
          <>
            <button
              onClick={startGame}
              className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-[0.97] transition-all duration-100"
            >
              <RotateCcw size={17} strokeWidth={2.5} />
              もう一回
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full h-14 bg-gray-800 border border-gray-700 rounded-2xl font-bold text-gray-300 flex items-center justify-center gap-2 active:scale-[0.97] transition-all duration-100"
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
