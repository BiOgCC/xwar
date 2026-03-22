import React from 'react'
import {
  Bitcoin,
  Wheat,
  Fish,
  Beef,
  Croissant,
  Utensils,
  Flame,
  Target,
  Factory,
  Atom,
  Pickaxe
} from 'lucide-react'
import type { CompanyType } from '../../types/company.types'

interface CompanyIconProps {
  type: CompanyType | string
  color?: string
  size?: number
  strokeWidth?: number
}

export default function CompanyIcon({ type, color = 'currentColor', size = 16, strokeWidth = 2 }: CompanyIconProps) {
  const props = { color, size, strokeWidth }

  switch (type) {
    case 'bitcoin_miner': return <Bitcoin {...props} />
    case 'wheat_farm': return <Wheat {...props} />
    case 'fish_farm': return <Fish {...props} />
    case 'steak_farm': return <Beef {...props} />
    case 'bakery': return <Croissant {...props} />
    case 'sushi_bar': return <Utensils {...props} />
    case 'wagyu_grill': return <Flame {...props} />
    case 'green_ammo_factory':
    case 'blue_ammo_factory':
    case 'purple_ammo_factory': return <Target {...props} />
    case 'oil_refinery': return <Factory {...props} />
    case 'materialx_refiner': return <Atom {...props} />
    case 'prospection_center': return <Pickaxe {...props} />
    default: return <Factory {...props} />
  }
}
