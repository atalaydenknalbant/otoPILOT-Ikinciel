"use client"
import { useMemo, useState } from 'react'
import Image from 'next/image'

// Candidate brands; component will try /brands/<slug>.svg then .png
const CANDIDATES = [
  'audi','bmw','mercedes-benz','volkswagen','toyota','honda','hyundai','kia',
  'renault','peugeot','citroen','opel','fiat','volvo','porsche','tesla',
  // extend as needed, file presence will be auto-handled
]

function BrandLogo({ slug }: { slug: string }) {
  const [ext, setExt] = useState<'svg' | 'png'>('svg')
  const [hidden, setHidden] = useState(false)
  const src = useMemo(() => `/brands/${slug}.${ext}`, [slug, ext])
  if (hidden) return null
  return (
    <div
      className="shrink-0 w-16 h-16 rounded-xl border border-gray-200 bg-white shadow-sm mx-2 flex items-center justify-center hover:bg-gray-50"
      title={slug}
    >
      <Image
        src={src}
        alt={slug}
        width={32}
        height={32}
        className="w-8 h-8 object-contain opacity-80"
        onError={() => {
          if (ext === 'svg') setExt('png')
          else setHidden(true)
        }}
      />
    </div>
  )
}

export default function IconsRow() {
  const logos = CANDIDATES
  const track = (
    <div className="marquee-track py-2 text-gray-600">
      {logos.map((slug) => (
        <BrandLogo key={slug} slug={slug} />
      ))}
      {/* duplicate for seamless loop */}
      {logos.map((slug, i) => (
        <BrandLogo key={`${slug}-dup-${i}`} slug={slug} />
      ))}
    </div>
  )
  return <div className="marquee">{track}</div>
}
