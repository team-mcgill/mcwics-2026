import { useState } from 'react'

const CATEGORIES = ['All', 'Masks', 'Accessories', 'Outfits', 'Effects']

const ITEMS = [
  { id: 1, name: 'Golden Phantom', category: 'Masks', price: 0.5, rarity: 'Legendary', image: '🎭' },
  { id: 2, name: 'Midnight Crown', category: 'Accessories', price: 0.3, rarity: 'Epic', image: '👑' },
  { id: 3, name: 'Velvet Cloak', category: 'Outfits', price: 0.25, rarity: 'Rare', image: '🧥' },
  { id: 4, name: 'Crystal Veil', category: 'Masks', price: 0.8, rarity: 'Legendary', image: '💎' },
  { id: 5, name: 'Starlight Aura', category: 'Effects', price: 1.2, rarity: 'Mythic', image: '✨' },
  { id: 6, name: 'Bronze Masque', category: 'Masks', price: 0.1, rarity: 'Common', image: '🎪' },
  { id: 7, name: 'Feathered Fan', category: 'Accessories', price: 0.15, rarity: 'Uncommon', image: '🪭' },
  { id: 8, name: 'Royal Robe', category: 'Outfits', price: 0.6, rarity: 'Epic', image: '👘' },
  { id: 9, name: 'Shadow Mantle', category: 'Effects', price: 0.9, rarity: 'Legendary', image: '🌑' },
]

const RARITY_STYLES = {
  Common: 'text-gray-500 bg-gray-500/10',
  Uncommon: 'text-green-500/80 bg-green-500/10',
  Rare: 'text-blue-500/80 bg-blue-500/10',
  Epic: 'text-purple-500/80 bg-purple-500/10',
  Legendary: 'text-[#d4af37] bg-[#d4af37]/10',
  Mythic: 'text-red-400/80 bg-red-400/10',
}

function StoreItem({ item }) {
  return (
    <div className="group relative bg-[#111] rounded-2xl overflow-hidden hover-lift inner-glow">
      <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Image Area */}
      <div className="relative aspect-square bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-5xl transform group-hover:scale-105 transition-transform duration-500">
          {item.image}
        </div>
        <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-light tracking-wider uppercase ${RARITY_STYLES[item.rarity]}`}>
          {item.rarity}
        </div>
      </div>

      {/* Info */}
      <div className="relative p-5">
        <h3 className="font-serif font-light text-white/90 mb-1 tracking-wide group-hover:text-[#f5f5dc] transition-elegant">
          {item.name}
        </h3>

        <p className="text-xs font-light text-[#718096] mb-5 tracking-wider uppercase">
          {item.category}
        </p>

        <div className="w-full h-px bg-white/5 mb-5" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195]" />
            <span className="font-light text-white/80">{item.price}</span>
            <span className="text-xs font-light text-[#718096]">SOL</span>
          </div>
          <button className="px-5 py-2 rounded-lg text-[#0a0a0a] text-xs font-light tracking-wider uppercase btn-convex transition-all duration-300">
            Buy
          </button>
        </div>
      </div>
    </div>
  )
}

function Store() {
  const [selectedCategory, setSelectedCategory] = useState('All')

  const filteredItems = selectedCategory === 'All'
    ? ITEMS
    : ITEMS.filter(item => item.category === selectedCategory)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d4af37]/5 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-16">
          <div className="text-center max-w-xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-serif font-light text-white mb-3 tracking-wider">
              The <span className="text-[#f5f5dc]">Boutique</span>
            </h1>
            <p className="text-sm font-light text-[#718096] tracking-wide">
              Adorn your mask with exquisite wearables. Each item is a unique NFT on Solana.
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-6 mb-12 mt-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-5 py-2 rounded-lg text-xs font-light tracking-wider uppercase transition-all duration-300 ${
                selectedCategory === category
                  ? 'bg-[#d4af37] text-[#0a0a0a]'
                  : 'bg-[#111] text-[#718096] hover:text-white inner-glow'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <StoreItem key={item.id} item={item} />
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4 opacity-50">🛍️</div>
            <h3 className="text-lg font-light text-white/80 mb-2 tracking-wide">No items found</h3>
            <p className="text-sm font-light text-[#718096]">Try selecting a different category</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Store
