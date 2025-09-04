import IconsRow from './IconsRow'
import SearchBar from './SearchBar'
import type { Parsed, SearchItem } from '../types'
import Logo from './Logo'

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
      <div className="container pl-0 pr-4 py-4 flex items-center gap-2 md:gap-3">
        <div className="shrink-0 -ml-2 md:-ml-3">
          <Logo src="/logo/logo.svg" desktopHeightClass="h-16 md:h-20 lg:h-24" mobileHeightClass="h-14" />
        </div>
        <div className="flex-1 min-w-0">
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
        <div className="hidden md:flex flex-none items-center gap-0 md:gap-1 ml-2 md:ml-3 mt-[25px] md:mt-[27px]">
          <button className="btn btn-gradient whitespace-nowrap">Become a Dealer</button>
          <button className="btn btn-gradient whitespace-nowrap">Log In</button>
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
