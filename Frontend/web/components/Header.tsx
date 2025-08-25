import IconsRow from './IconsRow'
import SearchBar from './SearchBar'

export default function Header({
  aiMode,
  onModeChange,
  onResults,
  onLoading,
  onParsed,
  modelReady,
  onModelReady,
}: {
  aiMode: boolean
  onModeChange: (b: boolean) => void
  onResults: (items: any[]) => void
  onLoading: (b: boolean) => void
  onParsed?: (json: any) => void
  modelReady: boolean
  onModelReady: (b: boolean) => void
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
          />
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button className="btn btn-ghost">Become a Dealer</button>
          <button className="btn btn-primary">Log In</button>
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
