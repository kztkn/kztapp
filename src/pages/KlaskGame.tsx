import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── 定数 ───────────────────────────────────────────────
const W = 360
const H = 600
const WALL = 10
const BALL_R = 13
const PADDLE_R = 14
const BISCUIT_R = 10
const GOAL_R = 26
const CORNER_R = 55                          // コーナー弧の半径
const CORNER_OFFSET = WALL + PADDLE_R + 20  // = 50 スタート位置のコーナーから内側
const MAX_BALL_SPEED = 14                    // ボール速度上限

const FRICTION = 0.995
const B_ATTACH_D = PADDLE_R + BISCUIT_R + 4  // = 36
const B_MAGNET_D = 80
const B_FORCE = 0.22
const B_FRICTION = 0.87
const WIN_SCORE = 5

// ゴールを内側へ（パドルが後ろを通れるよう壁から十分離す）
const GOAL_INSET = WALL + GOAL_R + PADDLE_R + 15  // = 65
const GOAL_P1 = { x: W / 2, y: H - GOAL_INSET }  // 下中央
const GOAL_P2 = { x: W / 2, y: GOAL_INSET }       // 上中央

// スタート位置（ホスト座標系）
// P1（下）の左右コーナー
const P1_CORNER_L = { x: CORNER_OFFSET, y: H - CORNER_OFFSET }
const P1_CORNER_R = { x: W - CORNER_OFFSET, y: H - CORNER_OFFSET }
// P2（上）の左右コーナー（ゲスト視点で左=ホスト右上、ゲスト視点で右=ホスト左上）
const P2_CORNER_GL = { x: W - CORNER_OFFSET, y: CORNER_OFFSET }  // ゲスト左
const P2_CORNER_GR = { x: CORNER_OFFSET, y: CORNER_OFFSET }       // ゲスト右

const INIT_P1 = P1_CORNER_R   // デフォルトは右下
const INIT_P2 = P2_CORNER_GL  // デフォルトは（ゲスト視点）左上=ホスト右上

// ─── 型 ─────────────────────────────────────────────────
type V2 = { x: number; y: number }
type Ball = { x: number; y: number; vx: number; vy: number }
type Biscuit = { x: number; y: number; vx: number; vy: number; who: null | 'p1' | 'p2'; ox: number; oy: number }
type GS = {
  ball: Ball
  biscuits: Biscuit[]
  score: { p1: number; p2: number }
  phase: 'waiting' | 'playing' | 'scored' | 'finished'
  loser: 'p1' | 'p2' | null
}

// ─── ユーティリティ ─────────────────────────────────────
const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function initBiscuits(): Biscuit[] {
  const cy = H / 2
  return [
    { x: W / 4,     y: cy, vx: 0, vy: 0, who: null, ox: 0, oy: 0 },
    { x: W / 2,     y: cy, vx: 0, vy: 0, who: null, ox: 0, oy: 0 },
    { x: 3 * W / 4, y: cy, vx: 0, vy: 0, who: null, ox: 0, oy: 0 },
  ]
}

function initGS(startBall = false): GS {
  return {
    ball: {
      x: W / 2, y: H / 2,
      vx: startBall ? (Math.random() - 0.5) * 6 : 0,
      vy: startBall ? 5 : 0,
    },
    biscuits: initBiscuits(),
    score: { p1: 0, p2: 0 },
    phase: startBall ? 'playing' : 'waiting',
    loser: null,
  }
}

// ボールとパドルの衝突（パドル速度を考慮）
function collideBallPaddle(ball: Ball, paddle: V2, paddleVel: V2): Ball {
  const d = dist(ball, paddle)
  const minD = BALL_R + PADDLE_R
  if (d >= minD || d < 0.001) return ball
  const nx = (ball.x - paddle.x) / d
  const ny = (ball.y - paddle.y) / d
  const overlap = minD - d

  // パドルに対するボールの相対速度
  const relVx = ball.vx - paddleVel.x
  const relVy = ball.vy - paddleVel.y
  const dot = relVx * nx + relVy * ny
  if (dot >= 0) {
    // 離れていく方向 → めり込みだけ解消
    return { ...ball, x: ball.x + nx * overlap, y: ball.y + ny * overlap }
  }

  const restitution = 1.35
  return {
    x: ball.x + nx * overlap,
    y: ball.y + ny * overlap,
    vx: ball.vx - 2 * dot * nx * restitution,
    vy: ball.vy - 2 * dot * ny * restitution,
  }
}

// ボールとビスケットの衝突（運動量保存）
function collideBallBiscuits(ball: Ball, biscuits: Biscuit[]): { ball: Ball; biscuits: Biscuit[] } {
  let b2 = ball
  const bs = biscuits.map(b => ({ ...b }))
  for (let i = 0; i < bs.length; i++) {
    const bi = bs[i]
    if (bi.who !== null) continue  // くっついているものは動かない
    const d = dist(b2, bi)
    const minD = BALL_R + BISCUIT_R
    if (d >= minD || d < 0.001) continue
    const nx = (b2.x - bi.x) / d
    const ny = (b2.y - bi.y) / d
    const overlap = minD - d
    const relVx = b2.vx - bi.vx
    const relVy = b2.vy - bi.vy
    const relDotN = relVx * nx + relVy * ny
    if (relDotN >= 0) continue
    const BM = 4, IM = 1, TM = BM + IM
    const imp = (2 * relDotN) / TM
    b2 = {
      x: b2.x + nx * (overlap * IM / TM),
      y: b2.y + ny * (overlap * IM / TM),
      vx: b2.vx - imp * IM * nx,
      vy: b2.vy - imp * IM * ny,
    }
    bs[i] = {
      ...bi,
      x: bi.x - nx * (overlap * BM / TM),
      y: bi.y - ny * (overlap * BM / TM),
      vx: bi.vx + imp * BM * nx,
      vy: bi.vy + imp * BM * ny,
    }
  }
  return { ball: b2, biscuits: bs }
}

// ─── コンポーネント ──────────────────────────────────────
export default function KlaskGame() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const role = params.get('role') as 'host' | 'guest'
  const roomCode = params.get('room') ?? ''
  const isHost = role === 'host'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(initGS())
  const p1Ref = useRef<V2>({ ...INIT_P1 })
  const p2Ref = useRef<V2>({ ...INIT_P2 })
  const prevP1Ref = useRef<V2>({ ...INIT_P1 })
  const prevP2Ref = useRef<V2>({ ...INIT_P2 })
  const rafRef = useRef(0)
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastBcRef = useRef(0)
  const paddleSendRef = useRef(0)
  const mountedRef = useRef(true)
  const scoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scoringRef = useRef(false)
  const chosenSideRef = useRef<'left' | 'right'>('right')

  const [uiScore, setUiScore] = useState({ p1: 0, p2: 0 })
  const [uiPhase, setUiPhase] = useState<GS['phase']>('waiting')
  const [uiLoser, setUiLoser] = useState<'p1' | 'p2' | null>(null)
  const [scoredMsg, setScoredMsg] = useState('')
  const [guestJoined, setGuestJoined] = useState(false)

  // ─── ゲーム再開 ────────────────────────────────────────
  const resumeGame = useCallback((scorer: 'p1' | 'p2', side: 'left' | 'right' = 'right') => {
    const savedScore = gsRef.current.score
    const loser = scorer === 'p1' ? 'p2' : 'p1'
    // 失点者のスタート位置を希望サイドに設定
    if (loser === 'p1') {
      p1Ref.current = side === 'left' ? { ...P1_CORNER_L } : { ...P1_CORNER_R }
      p2Ref.current = { ...INIT_P2 }
    } else {
      p2Ref.current = side === 'left' ? { ...P2_CORNER_GL } : { ...P2_CORNER_GR }
      p1Ref.current = { ...INIT_P1 }
    }
    prevP1Ref.current = { ...p1Ref.current }
    prevP2Ref.current = { ...p2Ref.current }
    scoringRef.current = false
    // ボールを失点者のパドル位置に配置（センター方向に少しオフセット）
    const paddlePos = loser === 'p1' ? p1Ref.current : p2Ref.current
    const dx = W / 2 - paddlePos.x
    const dy = H / 2 - paddlePos.y
    const d = Math.hypot(dx, dy)
    const off = PADDLE_R + BALL_R + 3
    gsRef.current = {
      ball: {
        x: paddlePos.x + (dx / d) * off,
        y: paddlePos.y + (dy / d) * off,
        vx: 0,
        vy: 0,
      },
      biscuits: initBiscuits(),
      score: savedScore,
      phase: 'playing',
      loser: null,
    }
    setUiPhase('playing')
    setScoredMsg('')
    setUiLoser(null)
  }, [])

  // ─── コーナー選択：ボタン押下で即ゲーム再開 ────
  const pickCorner = useCallback((side: 'left' | 'right') => {
    chosenSideRef.current = side
    if (isHost) {
      // ホストが失点者のとき → タイマーをキャンセルして即再開
      clearTimeout(scoreTimeoutRef.current)
      const loser = gsRef.current.loser
      if (loser) resumeGame(loser === 'p1' ? 'p2' : 'p1', side)
    } else {
      // ゲストが失点者のとき → ホストへ送信
      chRef.current?.send({
        type: 'broadcast',
        event: 'corner_pick',
        payload: { side },
      })
    }
  }, [isHost, resumeGame])

  // ─── 得点処理（ホストのみ） ───────────────────────────
  const handleScore = useCallback((scorer: 'p1' | 'p2', prevScore: { p1: number; p2: number }, reason: string) => {
    if (scoringRef.current) return
    scoringRef.current = true

    const newScore = { ...prevScore, [scorer]: prevScore[scorer] + 1 }
    const finished = newScore[scorer] >= WIN_SCORE
    const loser = scorer === 'p1' ? 'p2' : 'p1'

    gsRef.current = {
      ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
      biscuits: initBiscuits(),
      score: newScore,
      phase: finished ? 'finished' : 'scored',
      loser: finished ? null : loser,
    }
    p1Ref.current = { ...INIT_P1 }
    p2Ref.current = { ...INIT_P2 }
    setUiScore({ ...newScore })
    setUiPhase(finished ? 'finished' : 'scored')
    setUiLoser(finished ? null : loser)
    setScoredMsg(reason)

    if (!finished) {
      chosenSideRef.current = 'right'
      // 4秒後に誰もボタンを押さなかった場合のフォールバック
      scoreTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current || gsRef.current.phase !== 'scored') return
        resumeGame(scorer, chosenSideRef.current)
      }, 4000)
    }
  }, [resumeGame])

  // ─── 物理演算（ホストのみ） ───────────────────────────
  const updatePhysics = useCallback(() => {
    const gs = gsRef.current
    if (gs.phase !== 'playing') return

    const p1 = p1Ref.current
    const p2 = p2Ref.current
    const p1Vel = { x: p1.x - prevP1Ref.current.x, y: p1.y - prevP1Ref.current.y }
    const p2Vel = { x: p2.x - prevP2Ref.current.x, y: p2.y - prevP2Ref.current.y }
    prevP1Ref.current = { ...p1 }
    prevP2Ref.current = { ...p2 }

    let ball = { ...gs.ball }
    let biscuits = gs.biscuits.map(b => ({ ...b }))

    // ボール移動
    ball.x += ball.vx
    ball.y += ball.vy
    ball.vx *= FRICTION
    ball.vy *= FRICTION

    // 壁反射
    const bMin = WALL + BALL_R, bMaxX = W - WALL - BALL_R, bMaxY = H - WALL - BALL_R
    if (ball.x < bMin) { ball.x = bMin; ball.vx = Math.abs(ball.vx) }
    if (ball.x > bMaxX) { ball.x = bMaxX; ball.vx = -Math.abs(ball.vx) }
    if (ball.y < bMin) { ball.y = bMin; ball.vy = Math.abs(ball.vy) }
    if (ball.y > bMaxY) { ball.y = bMaxY; ball.vy = -Math.abs(ball.vy) }

    // 速度上限（跳ね返りで加速しすぎないよう）
    const spd = Math.hypot(ball.vx, ball.vy)
    if (spd > MAX_BALL_SPEED) {
      ball.vx = ball.vx / spd * MAX_BALL_SPEED
      ball.vy = ball.vy / spd * MAX_BALL_SPEED
    }

    // パドルとの衝突
    ball = collideBallPaddle(ball, p1, p1Vel)
    ball = collideBallPaddle(ball, p2, p2Vel)

    // ボールとビスケットの衝突
    const result = collideBallBiscuits(ball, biscuits)
    ball = result.ball
    biscuits = result.biscuits

    // ゴール判定（ボール）
    if (dist(ball, GOAL_P1) < GOAL_R - BALL_R / 2) {
      handleScore('p2', gs.score, '🎯 GOAL!'); return
    }
    if (dist(ball, GOAL_P2) < GOAL_R - BALL_R / 2) {
      handleScore('p1', gs.score, '🎯 GOAL!'); return
    }

    // クラスク判定（自分のゴール穴に自パドルが落ちる）
    if (dist(p1, GOAL_P1) < GOAL_R) {
      handleScore('p2', gs.score, '😱 クラスク！'); return
    }
    if (dist(p2, GOAL_P2) < GOAL_R) {
      handleScore('p1', gs.score, '😱 クラスク！'); return
    }

    // ビスケット更新（磁力・追従）
    for (const b of biscuits) {
      if (b.who === 'p1') {
        b.x = p1.x + b.ox; b.y = p1.y + b.oy; b.vx = 0; b.vy = 0; continue
      }
      if (b.who === 'p2') {
        b.x = p2.x + b.ox; b.y = p2.y + b.oy; b.vx = 0; b.vy = 0; continue
      }
      for (const [paddle, who] of [[p1, 'p1'], [p2, 'p2']] as [V2, 'p1' | 'p2'][]) {
        const dp = dist(b, paddle)
        if (dp < B_ATTACH_D) {
          b.who = who; b.ox = b.x - paddle.x; b.oy = b.y - paddle.y
          b.vx = 0; b.vy = 0; break
        } else if (dp < B_MAGNET_D) {
          b.vx += ((paddle.x - b.x) / dp) * B_FORCE
          b.vy += ((paddle.y - b.y) / dp) * B_FORCE
        }
      }
      if (!b.who) {
        b.x += b.vx; b.y += b.vy
        b.vx *= B_FRICTION; b.vy *= B_FRICTION
        b.x = clamp(b.x, WALL + BISCUIT_R, W - WALL - BISCUIT_R)
        b.y = clamp(b.y, WALL + BISCUIT_R, H - WALL - BISCUIT_R)
      }
    }

    // ビスケット2個以上でペナルティ
    if (biscuits.filter(b => b.who === 'p1').length >= 2) {
      handleScore('p2', gs.score, '🍪 ビスケット2個！'); return
    }
    if (biscuits.filter(b => b.who === 'p2').length >= 2) {
      handleScore('p1', gs.score, '🍪 ビスケット2個！'); return
    }

    gsRef.current = { ...gs, ball, biscuits }
  }, [handleScore])

  // ─── Canvas描画 ──────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gs = gsRef.current
    const p1 = p1Ref.current
    const p2 = p2Ref.current

    ctx.save()
    if (!isHost) { ctx.translate(W, H); ctx.rotate(Math.PI) }

    // フィールド背景（青）
    ctx.fillStyle = '#1a56db'
    ctx.fillRect(0, 0, W, H)

    // ─ フィールドライン（白）─
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2.5

    // 外枠
    ctx.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2)

    // センターライン
    ctx.save()
    ctx.setLineDash([10, 10])
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(WALL, H / 2); ctx.lineTo(W - WALL, H / 2); ctx.stroke()
    ctx.restore()

    // センターサークル
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 48, 0, Math.PI * 2); ctx.stroke()

    // コーナー弧（4隅）
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    // 左上
    ctx.beginPath(); ctx.arc(WALL, WALL, CORNER_R, 0, Math.PI / 2); ctx.stroke()
    // 右上
    ctx.beginPath(); ctx.arc(W - WALL, WALL, CORNER_R, Math.PI / 2, Math.PI); ctx.stroke()
    // 左下
    ctx.beginPath(); ctx.arc(WALL, H - WALL, CORNER_R, -Math.PI / 2, 0); ctx.stroke()
    // 右下
    ctx.beginPath(); ctx.arc(W - WALL, H - WALL, CORNER_R, Math.PI, Math.PI * 3 / 2); ctx.stroke()

    // ゴールエリア弧
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(GOAL_P2.x, GOAL_P2.y, 52, 0, Math.PI); ctx.stroke()
    ctx.beginPath(); ctx.arc(GOAL_P1.x, GOAL_P1.y, 52, Math.PI, Math.PI * 2); ctx.stroke()

    // ─ ゴール穴 ─
    // P2（上）- 水色
    ctx.fillStyle = '#7dd3fc'
    ctx.beginPath(); ctx.arc(GOAL_P2.x, GOAL_P2.y, GOAL_R, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke()

    // P1（下）- 水色
    ctx.fillStyle = '#7dd3fc'
    ctx.beginPath(); ctx.arc(GOAL_P1.x, GOAL_P1.y, GOAL_R, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke()

    // 穴の深さ表現（内側に暗い円）
    ctx.fillStyle = '#1e3a5f'
    ctx.beginPath(); ctx.arc(GOAL_P2.x, GOAL_P2.y, GOAL_R - 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1e3a5f'
    ctx.beginPath(); ctx.arc(GOAL_P1.x, GOAL_P1.y, GOAL_R - 6, 0, Math.PI * 2); ctx.fill()

    // ─ ビスケット（白） ─
    for (const b of gs.biscuits) {
      ctx.fillStyle = '#f0f0f0'
      ctx.strokeStyle = '#c0c0c0'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(b.x, b.y, BISCUIT_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      // 立体感（ハイライト）
      const gh = ctx.createRadialGradient(b.x - 4, b.y - 4, 1, b.x, b.y, BISCUIT_R)
      gh.addColorStop(0, 'rgba(255,255,255,0.7)')
      gh.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gh
      ctx.beginPath(); ctx.arc(b.x, b.y, BISCUIT_R, 0, Math.PI * 2); ctx.fill()
    }

    // ─ ボール（黄色） ─
    ctx.shadowColor = 'rgba(251,191,36,0.6)'
    ctx.shadowBlur = 12
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath(); ctx.arc(gs.ball.x, gs.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill()
    // ハイライト
    const gb = ctx.createRadialGradient(gs.ball.x - 4, gs.ball.y - 4, 1, gs.ball.x, gs.ball.y, BALL_R)
    gb.addColorStop(0, 'rgba(255,255,200,0.8)')
    gb.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = gb
    ctx.beginPath(); ctx.arc(gs.ball.x, gs.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    // ─ P1パドル（黒） ─
    const g1 = ctx.createRadialGradient(p1.x - 5, p1.y - 5, 2, p1.x, p1.y, PADDLE_R)
    g1.addColorStop(0, '#555'); g1.addColorStop(1, '#111')
    ctx.fillStyle = g1; ctx.strokeStyle = '#777'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(p1.x, p1.y, PADDLE_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2); ctx.fill()

    // ─ P2パドル（黒） ─
    const g2 = ctx.createRadialGradient(p2.x - 5, p2.y - 5, 2, p2.x, p2.y, PADDLE_R)
    g2.addColorStop(0, '#555'); g2.addColorStop(1, '#111')
    ctx.fillStyle = g2; ctx.strokeStyle = '#777'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(p2.x, p2.y, PADDLE_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.arc(p2.x, p2.y, 5, 0, Math.PI * 2); ctx.fill()

    ctx.restore()
  }, [isHost])

  // ─── タッチ/ポインタハンドラ ──────────────────────────
  const handlePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    let x = (clientX - rect.left) * (W / rect.width)
    let y = (clientY - rect.top) * (H / rect.height)
    if (!isHost) { x = W - x; y = H - y }

    const pMin = WALL + PADDLE_R
    const pMaxX = W - WALL - PADDLE_R
    // ゴール穴に届くよう上下はWALL際まで
    const pMinY = isHost ? H / 2 + 2 : pMin
    const pMaxY = isHost ? H - WALL - 1 : H / 2 - 2

    x = clamp(x, pMin, pMaxX)
    y = clamp(y, pMinY, pMaxY)

    if (isHost) { p1Ref.current = { x, y } }
    else { p2Ref.current = { x, y } }

    const now = Date.now()
    if (now - paddleSendRef.current > 16) {
      paddleSendRef.current = now
      chRef.current?.send({
        type: 'broadcast',
        event: 'paddle_move',
        payload: { x, y, role },
      })
    }
  }, [isHost, role])

  // ─── ゲームループ ────────────────────────────────────
  const gameLoop = useCallback(() => {
    if (isHost) {
      updatePhysics()
      const now = Date.now()
      if (now - lastBcRef.current > 16) {
        lastBcRef.current = now
        chRef.current?.send({
          type: 'broadcast',
          event: 'game_state',
          payload: {
            ball: gsRef.current.ball,
            biscuits: gsRef.current.biscuits,
            score: gsRef.current.score,
            phase: gsRef.current.phase,
            loser: gsRef.current.loser,
            p1: p1Ref.current,
          },
        })
      }
    }
    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [isHost, updatePhysics, draw])

  // ─── Supabase Realtime ───────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`klask:${roomCode}`, {
      config: { broadcast: { self: false } },
    })

    ch.on('broadcast', { event: 'game_state' }, ({ payload }) => {
      if (isHost) return
      gsRef.current = {
        ball: payload.ball,
        biscuits: payload.biscuits,
        score: payload.score,
        phase: payload.phase,
        loser: payload.loser,
      }
      p1Ref.current = payload.p1
      setUiScore(payload.score)
      setUiPhase(payload.phase)
      setUiLoser(payload.loser)
    })

    ch.on('broadcast', { event: 'paddle_move' }, ({ payload }) => {
      if (payload.role === 'host' && !isHost) p1Ref.current = { x: payload.x, y: payload.y }
      else if (payload.role === 'guest' && isHost) p2Ref.current = { x: payload.x, y: payload.y }
    })

    // ゲストがコーナー選択 → ホストはタイマーをキャンセルして即再開
    ch.on('broadcast', { event: 'corner_pick' }, ({ payload }) => {
      if (!isHost) return
      clearTimeout(scoreTimeoutRef.current)
      const side = payload.side as 'left' | 'right'
      const loser = gsRef.current.loser
      if (loser) resumeGame(loser === 'p1' ? 'p2' : 'p1', side)
    })

    ch.on('broadcast', { event: 'guest_joined' }, () => setGuestJoined(true))

    ch.subscribe(() => {
      if (!isHost) ch.send({ type: 'broadcast', event: 'guest_joined', payload: {} })
    })

    chRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [roomCode, isHost, resumeGame])

  // ─── ゲームループ開始 ─────────────────────────────────
  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameLoop])

  // ─── アンマウント ─────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false
      clearTimeout(scoreTimeoutRef.current)
    }
  }, [])

  // ─── ホストがゲームスタート ──────────────────────────
  const startGame = useCallback(() => {
    const newGS = initGS(true)
    gsRef.current = newGS
    p1Ref.current = { ...INIT_P1 }
    p2Ref.current = { ...INIT_P2 }
    prevP1Ref.current = { ...INIT_P1 }
    prevP2Ref.current = { ...INIT_P2 }
    setUiPhase('playing')
    scoringRef.current = false
  }, [])

  // ─── UI ───────────────────────────────────────────────
  const myScore = isHost ? uiScore.p1 : uiScore.p2
  const oppScore = isHost ? uiScore.p2 : uiScore.p1
  const myColor = isHost ? 'text-blue-400' : 'text-red-400'
  const oppColor = isHost ? 'text-red-400' : 'text-blue-400'

  const winner = uiPhase === 'finished'
    ? (uiScore.p1 >= WIN_SCORE
      ? (isHost ? '自分' : '相手')
      : (isHost ? '相手' : '自分'))
    : null

  // choosing フェーズで自分が失点者かどうか
  const iAmLoser = (uiLoser === 'p1' && isHost) || (uiLoser === 'p2' && !isHost)

  return (
    <div
      className="h-screen bg-gray-950 text-white flex flex-col items-center justify-between select-none overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* ヘッダー */}
      <div className="w-full max-w-xs flex items-center justify-between px-2 pt-3 pb-1 shrink-0">
        <button onClick={() => navigate('/klask')} className="p-2 rounded-xl text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-5 text-sm font-bold">
          <span className={oppColor}>相手 {oppScore}</span>
          <span className="text-gray-600 text-xs">vs</span>
          <span className={myColor}>自分 {myScore}</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Canvas */}
      <div className="relative flex-1 flex items-center justify-center w-full">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-2xl border border-blue-900 touch-none"
          style={{ maxHeight: 'calc(100vh - 100px)', width: 'auto' }}
          onPointerMove={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e.clientX, e.clientY) }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e.clientX, e.clientY) }}
          onTouchMove={(e) => { e.preventDefault(); handlePointer(e.touches[0].clientX, e.touches[0].clientY) }}
        />

        {/* 待機（ホスト） */}
        {uiPhase === 'waiting' && isHost && (
          <div className="absolute inset-0 bg-black/65 rounded-2xl flex flex-col items-center justify-center gap-5">
            <div className="text-center space-y-1">
              <p className="text-gray-300 text-sm">ルームコード</p>
              <p className="text-emerald-400 font-black text-4xl font-mono tracking-widest">{roomCode}</p>
              {guestJoined && <p className="text-emerald-300 text-sm mt-2">✅ 友達が参加しました！</p>}
            </div>
            <button onClick={startGame} className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl font-bold text-lg active:scale-95 transition-transform">
              ゲームスタート！
            </button>
          </div>
        )}

        {/* 待機（ゲスト） */}
        {uiPhase === 'waiting' && !isHost && (
          <div className="absolute inset-0 bg-black/65 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300 text-sm">ホストの開始を待ち中…</p>
          </div>
        )}

        {/* 得点演出 + コーナー選択 */}
        {uiPhase === 'scored' && (
          <div className="absolute inset-0 bg-black/65 rounded-2xl flex flex-col items-center justify-center gap-4">
            {scoredMsg && <p className="text-4xl font-black drop-shadow-lg">{scoredMsg}</p>}
            {iAmLoser && (
              <>
                <p className="text-white font-bold text-sm mt-2">どちらから始める？</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => pickCorner('left')}
                    className="w-32 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-lg active:scale-95 transition-all"
                  >
                    ← 左
                  </button>
                  <button
                    onClick={() => pickCorner('right')}
                    className="w-32 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-lg active:scale-95 transition-all"
                  >
                    右 →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ゲーム終了 */}
        {uiPhase === 'finished' && (
          <div className="absolute inset-0 bg-black/75 rounded-2xl flex flex-col items-center justify-center gap-5">
            <Trophy size={44} className="text-yellow-400" />
            <div className="text-center">
              <p className="text-3xl font-black">{winner === '自分' ? '🎉 勝ち！' : '😢 負け…'}</p>
              <p className="text-gray-400 text-sm mt-1">{uiScore.p1} - {uiScore.p2}</p>
            </div>
            <button onClick={() => navigate('/klask')} className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl font-bold active:scale-95 transition-transform">
              もう一度
            </button>
          </div>
        )}
      </div>

      {/* ルール */}
      {uiPhase === 'playing' && (
        <div className="text-gray-700 text-xs pb-3 shrink-0">
          ゴール=得点 / 自ゴールに落ちる=クラスク / ビスケット2個=失点
        </div>
      )}
    </div>
  )
}
