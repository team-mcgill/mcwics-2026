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

const RARITY_COLORS = {
  Common: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Uncommon: 'bg-green-500/20 text-green-400 border-green-500/30',
  Rare: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Epic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Legendary: 'bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/30',
  Mythic: 'bg-red-500/20 text-red-400 border-red-500/30',
}

function StoreItem({ item }) {
  return (
    <div className="group relative bg-gradient-to-br from-[#141414] to-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden hover:border-[#d4af37]/30 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Image Area */}
      <div className="relative aspect-square bg-gradient-to-br from-[#0a0a0a] to-[#141414] flex items-center justify-center">
        <div className="text-6xl transform group-hover:scale-110 transition-transform duration-300">
          {item.image}
        </div>
        <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium border ${RARITY_COLORS[item.rarity]}`}>
          {item.rarity}
        </div>
      </div>

      {/* Info */}
      <div className="relative p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-serif font-semibold text-white group-hover:text-[#d4af37] transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-sm text-[#a0a0a0] mb-4">{item.category}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195]" />
            <span className="font-medium text-white">{item.price}</span>
            <span className="text-sm text-[#a0a0a0]">SOL</span>
          </div>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#8b7355] text-[#0a0a0a] text-sm font-medium hover:from-[#e8c547] hover:to-[#a08060] transition-all transform group-hover:scale-105">
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

        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5f5dc]">Boutique</span>
            </h1>
            <p className="text-[#a0a0a0]">
              Adorn your mask with exquisite wearables. Each item is a unique NFT on Solana.
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-6 mb-10">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#8b7355] text-[#0a0a0a]'
                  : 'bg-white/5 text-[#a0a0a0] border border-white/10 hover:bg-white/10 hover:text-white'
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
            <div className="text-4xl mb-4">🛍️</div>
            <h3 className="text-xl font-medium text-white mb-2">No items found</h3>
            <p className="text-[#a0a0a0]">Try selecting a different category</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Store
