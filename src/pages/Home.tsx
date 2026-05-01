import { useNavigate } from 'react-router-dom'

const games = [
  {
    path: '/mash',
    emoji: '👆',
    title: '連打ゲーム',
    description: '5秒で何回押せる？',
    color: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-500/30',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            kztapp
          </h1>
          <p className="text-gray-400 text-sm">ミニゲーム集</p>
        </div>

        <div className="space-y-3">
          {games.map((game) => (
            <button
              key={game.path}
              onClick={() => navigate(game.path)}
              className={`w-full bg-gradient-to-r ${game.color} ${game.shadow} shadow-lg rounded-2xl p-5 text-left active:scale-95 transition-transform duration-100`}
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl">{game.emoji}</span>
                <div>
                  <p className="font-bold text-lg leading-tight">{game.title}</p>
                  <p className="text-white/70 text-sm">{game.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
