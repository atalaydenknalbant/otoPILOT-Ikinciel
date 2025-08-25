const brands = [
  'Audi','BMW','Mercedes','Volkswagen','Toyota','Honda','Hyundai','Kia',
  'Renault','Peugeot','Citroën','Opel','Fiat','Volvo','Porsche','Tesla',
]

export default function IconsRow() {
  const track = (
    <div className="marquee-track py-1 text-gray-600">
      {brands.map((b) => (
        <div
          key={b}
          className="shrink-0 px-4 py-1 rounded-full border border-gray-200 bg-white shadow-sm text-sm"
        >
          {b}
        </div>
      ))}
      {/* duplicate for seamless loop */}
      {brands.map((b, i) => (
        <div
          key={b + '-dup-' + i}
          className="shrink-0 px-4 py-1 rounded-full border border-gray-200 bg-white shadow-sm text-sm"
        >
          {b}
        </div>
      ))}
    </div>
  )
  return (
    <div className="marquee">
      {track}
    </div>
  )
}
