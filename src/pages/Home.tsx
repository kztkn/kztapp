import { useNavigate } from 'react-router-dom'
import { Zap, ChevronRight, Disc } from 'lucide-react'

const games = [
  {
    path: '/mash',
    Icon: Zap,
    title: '連打ゲーム',
    description: '5秒で何回押せる？',
    iconColor: 'text-violet-300',
    iconBg: 'bg-violet-500/20',
    color: 'from-violet-500/10 to-purple-600/10',
    border: 'border-violet-500/20',
  },
  {
    path: '/klask',
    Icon: Disc,
    title: 'クラスク',
    description: '友達と1:1対戦！先に5点取ったら勝ち',
    iconColor: 'text-emerald-300',
    iconBg: 'bg-emerald-500/20',
    color: 'from-emerald-500/10 to-teal-600/10',
    border: 'border-emerald-500/20',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            kztapp
          </h1>
          <p className="text-gray-500 text-sm">ミニゲーム集</p>
        </div>

        <div className="space-y-3">
          {games.map((game) => {
            const Icon = game.Icon
            return (
              <button
                key={game.path}
                onClick={() => navigate(game.path)}
                className={`w-full bg-gradient-to-r ${game.color} border ${game.border} rounded-2xl p-5 text-left active:scale-[0.97] transition-transform duration-100`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${game.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon size={24} className={game.iconColor} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-tight">{game.title}</p>
                    <p className="text-gray-400 text-sm mt-0.5">{game.description}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-600 shrink-0" />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
