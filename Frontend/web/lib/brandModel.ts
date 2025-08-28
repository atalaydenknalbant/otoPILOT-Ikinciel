export type BrandModels = { brand: string; models: string[] }

// Lightweight fallback if public data is missing
const FALLBACK: BrandModels[] = [
  { brand: 'Audi', models: ['A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'TT'] },
  { brand: 'BMW', models: ['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi'] },
  { brand: 'Mercedes-Benz', models: ['A Serisi', 'C Serisi', 'E Serisi', 'GLA', 'GLC'] },
  { brand: 'Volkswagen', models: ['Golf', 'Polo', 'Passat', 'Tiguan'] },
  { brand: 'Renault', models: ['Clio', 'Megane', 'Talisman'] },
  { brand: 'Toyota', models: ['Corolla', 'Yaris', 'C-HR'] },
]

export async function loadBrandModels(): Promise<BrandModels[]> {
  try {
    const res = await fetch('/data/arabam_sequence_categories.json', { cache: 'force-cache' })
    if (!res.ok) throw new Error('not ok')
    const json = await res.json()
    const cars = json?.arabalar || {}
    const all: BrandModels[] = []
    for (const key of Object.keys(cars)) {
      const arr = Array.isArray(cars[key]) ? cars[key] : []
      for (const item of arr) {
        if (item?.marka) {
          all.push({ brand: String(item.marka), models: Array.isArray(item.modeller) ? item.modeller : [] })
        }
      }
    }
    // Deduplicate brands that may appear across categories
    const map = new Map<string, Set<string>>()
    for (const { brand, models } of all) {
      const set = map.get(brand) || new Set<string>()
      models.forEach(m => set.add(m))
      map.set(brand, set)
    }
    return Array.from(map.entries())
      .map(([brand, set]) => ({ brand, models: Array.from(set.values()).sort() }))
      .sort((a, b) => a.brand.localeCompare(b.brand, 'tr'))
  } catch {
    return FALLBACK
  }
}

export function filterBrands(brands: BrandModels[], q: string) {
  const s = q.trim().toLocaleLowerCase('tr')
  if (!s) return brands
  return brands.filter(b => b.brand.toLocaleLowerCase('tr').includes(s))
}

export function getModelsForBrand(brands: BrandModels[], brand?: string): string[] {
  if (!brand) return []
  const hit = brands.find(b => b.brand === brand)
  return hit ? hit.models : []
}
