import Link from 'next/link'
import Image from 'next/image'
import clsx from 'clsx'

/**
 * Logo component
 * - Places the app logo on the UI (default: top-left in Header)
 * - Uses /logo.svg from public/ by default
 * - Responsive by default, accepts optional size overrides
 */
export default function Logo({
  href = '/',
  src = '/logo/logo.svg',
  width = 160, // intrinsic, actual display size is controlled by CSS heights below
  height = 40,
  className,
  desktopHeightClass = 'h-8',
  mobileHeightClass = 'h-7',
}: {
  href?: string
  src?: string
  width?: number
  height?: number
  className?: string
  desktopHeightClass?: string
  mobileHeightClass?: string
}) {
  return (
    <Link href={href} className={clsx('inline-flex items-center', className)} aria-label="Ana sayfa">
      {/* Desktop / md+: compact height like the old design */}
      <span className="hidden sm:inline-flex">
        <Image
          src={src}
          alt="OTOPILOT"
          width={width}
          height={height}
          priority
          className={clsx(desktopHeightClass, 'w-auto')}
        />
      </span>
      {/* Mobile: even smaller */}
      <span className="sm:hidden inline-flex">
        <Image
          src={src}
          alt="OTOPILOT"
          width={width}
          height={height}
          priority
          className={clsx(mobileHeightClass, 'w-auto')}
        />
      </span>
    </Link>
  )
}
