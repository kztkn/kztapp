import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Flame, Home, CheckCircle } from 'lucide-react'

const STORAGE_KEY = 'gym-records'

function getDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getTodayStr(): string {
  return getDateStr(new Date())
}

function getPrevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return getDateStr(d)
}

function calcStreak(records: Set<string>): number {
  if (records.size === 0) return 0
  const today = getTodayStr()
  let current = records.has(today) ? today : records.has(getPrevDay(today)) ? getPrevDay(today) : null
  if (!current) return 0
  let count = 0
  while (records.has(current)) {
    count++
    current = getPrevDay(current)
  }
  return count
}

export default function GymTracker() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<Set<string>>(new Set())
  const today = getTodayStr()
  const doneToday = records.has(today)
  const streak = calcStreak(records)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setRecords(new Set(JSON.parse(stored) as string[]))
  }, [])

  function toggleToday() {
    setRecords(prev => {
      const next = new Set(prev)
      if (next.has(today)) next.delete(today)
      else next.add(today)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const monthLabel = `${year}年${month + 1}月`
  const dayLabels = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <Home size={20} className="text-gray-400" />
          </button>
          <h1 className="text-lg font-bold">ジムトラッカー</h1>
          <div className="w-9" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-orange-500/10 to-red-600/10 border border-orange-500/20 rounded-2xl p-4 flex flex-col items-center gap-1">
            <Flame size={20} className="text-orange-400" />
            <span className="text-3xl font-bold">{streak}</span>
            <span className="text-gray-400 text-xs">連続記録</span>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center gap-1">
            <Dumbbell size={20} className="text-emerald-400" />
            <span className="text-3xl font-bold">{records.size}</span>
            <span className="text-gray-400 text-xs">累計回数</span>
          </div>
        </div>

        <button
          onClick={toggleToday}
          className={`w-full rounded-2xl p-6 text-center transition-all duration-200 active:scale-[0.97] ${
            doneToday
              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-600/20 border border-emerald-500/40'
              : 'bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/40'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            {doneToday
              ? <CheckCircle size={40} className="text-emerald-400" />
              : <Dumbbell size={40} className="text-gray-400" />
            }
            <div>
              <p className={`text-xl font-bold ${doneToday ? 'text-emerald-300' : 'text-white'}`}>
                {doneToday ? '今日も行った！' : '今日のジム'}
              </p>
              <p className="text-gray-500 text-sm mt-0.5">
                {doneToday ? 'タップで取り消し' : 'タップして記録'}
              </p>
            </div>
          </div>
        </button>

        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-3">
          <p className="text-center text-sm font-semibold text-gray-300">{monthLabel}</p>
          <div className="grid grid-cols-7 gap-1">
            {dayLabels.map(d => (
              <div key={d} className="text-center text-xs text-gray-600 pb-1">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = dateStr === today
              const done = records.has(dateStr)
              return (
                <div
                  key={day}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium
                    ${done ? 'bg-emerald-500/30 text-emerald-300' : isToday ? 'border border-gray-600 text-gray-300' : 'text-gray-600'}
                    ${isToday && done ? 'ring-1 ring-emerald-400' : ''}
                  `}
                >
                  {day}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
