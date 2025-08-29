import IconsRow from './IconsRow'
import SearchBar from './SearchBar'
import type { Parsed, SearchItem } from '../types'

export default function Header({
  aiMode,
  onModeChange,
  onResults,
  onLoading,
  onParsed,
  modelReady,
  onModelReady,
  parsed,
}: {
  aiMode: boolean
  onModeChange: (b: boolean) => void
  onResults: (items: SearchItem[]) => void
  onLoading: (b: boolean) => void
  onParsed?: (json: Parsed) => void
  modelReady: boolean
  onModelReady: (b: boolean) => void
  parsed?: Parsed
}) {
  return (
    <header className="bg-white/70 backdrop-blur border-b border-gray-100">
      <div className="container py-4 flex items-center gap-4">
        <div className="text-2xl font-semibold tracking-tight"><span className="text-brand-700">OTO</span>PILOT</div>
        <div className="flex-1">
          <SearchBar
            aiMode={aiMode}
            onModeChange={onModeChange}
            onResults={onResults}
            onLoading={onLoading}
            onParsed={onParsed}
            modelReady={modelReady}
            onModelReady={onModelReady}
            parsed={parsed}
          />
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button className="btn btn-gradient">Become a Dealer</button>
          <button className="btn btn-gradient">Log In</button>
        </div>
      </div>
      <div className="border-t border-gray-100">
        <div className="container py-3">
          <IconsRow />
        </div>
      </div>
    </header>
  )
}
