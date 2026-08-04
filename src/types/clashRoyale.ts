export interface Card {
  name: string;
  id: number;
  level: number;
  starLevel?: number;
  maxLevel: number;
  count: number;
  key?: string; 
  form?: string; 
  activeForm?: string; 
  slot?: string; 
  _forceForm?: 'hero' | 'evo' | 'normal'; // Internal override for deck visualization
  iconUrls: {
    medium: string;
    evolutionMedium?: string;
    heroMedium?: string; 
  };
  rarity: string;
  evolutionLevel?: number;
  heroLevel?: number;
}

/**
 * DYNAMIC DETECTION LOGIC
 * Disambiguation between Evolutions and Heroes.
 * For DECK cards, we use metadata. For USER cards, we use levels.
 */

// Global registry to share dynamically discovered icon URLs and variant availability across the app
export const globalIconRegistry: Record<number, { 
  medium?: string; 
  evolutionMedium?: string; 
  heroMedium?: string;
  hasEvo?: boolean;
  hasHero?: boolean;
}> = {};

export const registerCardIcons = (cards: Card[]) => {
  if (!cards || !Array.isArray(cards)) return;
  cards.forEach(c => {
    if (c && c.id && c.iconUrls) {
      if (!globalIconRegistry[c.id]) globalIconRegistry[c.id] = {};
      
      const registryEntry = globalIconRegistry[c.id];
      
      if (c.iconUrls.medium) registryEntry.medium = c.iconUrls.medium;
      if (c.iconUrls.evolutionMedium) {
        registryEntry.evolutionMedium = c.iconUrls.evolutionMedium;
        registryEntry.hasEvo = true;
      }
      if (c.iconUrls.heroMedium) {
        registryEntry.heroMedium = c.iconUrls.heroMedium;
        registryEntry.hasHero = true;
      }

      // Also heuristically flag if the card name contains 'evolved' or 'hero' just in case
      // the official API didn't provide the URL but the metadata hints at it.
      const nameLower = (c.name || '').toLowerCase();
      if (nameLower.includes('evolved') || nameLower.includes('evolution')) registryEntry.hasEvo = true;
      if (nameLower.includes('hero')) registryEntry.hasHero = true;
    }
  });
};


export const isChampion = (card: Card) => {
  return card.rarity?.toLowerCase() === 'champion' || card.activeForm === 'champion';
};

export const isEvoUnlocked = (card: Card) => {
  if (card._forceForm === 'evo') return true;
  if (card._forceForm === 'hero' || card._forceForm === 'normal') return false;

  // 1. Trust evolutionLevel bitmask (1 = Evo, 2 = Hero, 3 = Both)
  if (card.evolutionLevel !== undefined && card.evolutionLevel > 0) {
    if ((card.evolutionLevel & 1) === 1) return true;
  }

  // 2. Check metadata keys and icon URLs
  const key = (card.key || '').toLowerCase();
  const form = (card.form || '').toLowerCase();
  const activeForm = (card.activeForm || '').toLowerCase();
  const iconUrl = (card.iconUrls?.medium || '').toLowerCase();
  
  if (key.endsWith('-evo') || form === 'evolution' || form === 'evo' || activeForm === 'evolution' || activeForm === 'evo') return true;
  if (iconUrl.includes('evo') || iconUrl.includes('ev1')) return true;

  // 3. Last resort: check name
  const name = (card.name || '').toLowerCase();
  if (name.includes('evolved') || name.includes('evolution')) return true;

  return false;
};

export const isHeroVariantUnlocked = (card: Card) => {
  if (card._forceForm === 'hero') return true;
  if (card._forceForm === 'evo' || card._forceForm === 'normal') return false;

  // 1. Trust heroLevel or evolutionLevel bitmask (2 = Hero)
  if (card.heroLevel !== undefined && card.heroLevel > 0) return true;
  
  if (card.evolutionLevel !== undefined && card.evolutionLevel > 0) {
    if ((card.evolutionLevel & 2) === 2) return true;
  }

  // 2. Check metadata keys and icon URLs
  const key = (card.key || '').toLowerCase();
  const form = (card.form || '').toLowerCase();
  const activeForm = (card.activeForm || '').toLowerCase();
  const iconUrl = (card.iconUrls?.medium || '').toLowerCase();

  if (key.endsWith('-hero') || form === 'hero' || activeForm === 'hero' || iconUrl.includes('hero')) return true;
  if (card.rarity?.toLowerCase() === 'hero' || (card.name || '').toLowerCase().includes('hero')) return true;

  return false;
};

export const isAnyHeroUnlocked = (card: Card) => {
  return isChampion(card) || isHeroVariantUnlocked(card);
};

// Check if the card definition has an Evolution version available (Static check)
export const hasEvoAvailable = (card: Card) => {
  if (!card) return false;
  
  // 1. Explicit payload check on the specific instance
  if (card.iconUrls?.evolutionMedium || (card.name || '').toLowerCase().includes('evolved')) return true;

  // 2. Check the global registry populated dynamically from Royale API's full card list
  if (globalIconRegistry[card.id]?.hasEvo) return true;

  return false;
};

// Check if the card definition has a Hero version available (Static check)
export const hasHeroAvailable = (card: Card) => {
  if (!card) return false;
  const name = (card.name || '').toLowerCase();
  const rarity = (card.rarity || '').toLowerCase();

  // Champions are NOT Heroes in this context (they have their own section)
  if (rarity === 'champion') return false;

  // 1. Explicit payload check on the specific instance
  if (card.iconUrls?.heroMedium || name.includes('hero') || rarity === 'hero') return true;

  // 2. Check the global registry populated dynamically from Royale API's full card list
  if (globalIconRegistry[card.id]?.hasHero) return true;

  return false;
};

// Aliases for backward compatibility
export const isEvo = (card: Card) => isEvoUnlocked(card);
export const isHeroVariant = (card: Card) => isHeroVariantUnlocked(card);
export const isAnyHero = (card: Card) => isAnyHeroUnlocked(card);

export interface PlayerProfile {
  tag: string;
  name: string;
  expLevel: number;
  collectionLevel?: number;
  trophies: number;
  bestTrophies: number;
  wins: number;
  losses: number;
  battleCount: number;
  threeWeaponWins: number;
  cards: Card[];
  supportCards?: Card[];
  currentDeck: Card[];
  currentFavouriteCard?: Card;
}

export interface MagicItems {
  commonWild: number;
  rareWild: number;
  epicWild: number;
  legendaryWild: number;
  championWild: number;
  evoShards: number | '';
  heroCoins: number | '';
  specificEvoShards?: Record<string, number>;
  gems?: number | '';
}

const UPGRADE_REQUIREMENTS: Record<string, Record<number, number>> = {
  common: {
    1: 2, 2: 4, 3: 10, 4: 20, 5: 50, 6: 100, 7: 200, 8: 400, 9: 400, 10: 800, 11: 1500, 12: 2500, 13: 3500, 14: 5500, 15: 7500
  },
  rare: {
    3: 2, 4: 4, 5: 10, 6: 20, 7: 50, 8: 100, 9: 100, 10: 200, 11: 400, 12: 550, 13: 750, 14: 1000, 15: 1400
  },
  epic: {
    6: 2, 7: 4, 8: 10, 9: 10, 10: 20, 11: 40, 12: 70, 13: 100, 14: 130, 15: 180
  },
  legendary: {
    9: 2, 10: 4, 11: 6, 12: 9, 13: 12, 14: 14, 15: 20
  },
  champion: {
    11: 2, 12: 5, 13: 8, 14: 11, 15: 15
  },
  hero: {
    11: 2, 12: 5, 13: 8, 14: 11, 15: 15
  }
};

export const getCardsToNextLevel = (rarity: string, displayLevel: number): number => {
  const normalizedRarity = (rarity || 'common').toLowerCase();
  const requirementsTable = UPGRADE_REQUIREMENTS[normalizedRarity];
  if (!requirementsTable) return 0;
  
  return requirementsTable[displayLevel] || 0;
};

export const getGemsCost = (rarity: string, missingCards: number): number => {
  if (missingCards <= 0) return 0;
  switch ((rarity || 'common').toLowerCase()) {
    case 'common': return Math.ceil(missingCards * (419 / 1164));
    case 'rare': return Math.ceil(missingCards * (1707 / 797));
    case 'epic': return Math.ceil(missingCards * (307 / 16));
    case 'legendary': return Math.ceil(missingCards * (844 / 4));
    case 'champion': return Math.ceil(missingCards * (800 / 2));
    case 'hero': return Math.ceil(missingCards * (800 / 2));
    default: return 0;
  }
};

const UPGRADE_GOLD_COST: Record<number, number> = {
  1: 5, 2: 20, 3: 50, 4: 150, 5: 400, 6: 1000, 7: 2000, 8: 4000, 
  9: 5000, 10: 15000, 11: 25000, 12: 40000, 13: 60000, 14: 90000, 15: 120000, 16: 0
};

export const getVirtualLevelAndGold = (
  rarity: string, 
  currentDisplayLevel: number, 
  currentCount: number,
  wildCards: number = 0,
  gems: number = 0
): { virtualLevel: number, totalGold: number, remainingCount: number, remainingWildCards: number, remainingGems: number } => {
  let virtualLevel = currentDisplayLevel;
  let totalGold = 0;
  let remainingCount = currentCount;
  let remainingWildCards = wildCards;
  let remainingGems = gems;
  
  while (virtualLevel < 16) {
    const requiredCards = getCardsToNextLevel(rarity, virtualLevel);
    if (requiredCards > 0) {
      let deficit = requiredCards - remainingCount;
      
      let usedWilds = 0;
      let usedGems = 0;
      
      if (deficit > 0) {
        if (remainingWildCards >= deficit) {
          usedWilds = deficit;
          deficit = 0;
        } else {
          usedWilds = remainingWildCards;
          deficit -= remainingWildCards;
        }
      }
      
      if (deficit > 0) {
        const cost = getGemsCost(rarity, deficit);
        if (remainingGems >= cost) {
          usedGems = cost;
          deficit = 0;
        }
      }
      
      if (deficit <= 0) {
        if (remainingCount >= requiredCards) {
          remainingCount -= requiredCards;
        } else {
          remainingCount = 0;
          remainingWildCards -= usedWilds;
          remainingGems -= usedGems;
        }
        totalGold += (UPGRADE_GOLD_COST[virtualLevel] || 0);
        virtualLevel++;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return { virtualLevel, totalGold, remainingCount, remainingWildCards, remainingGems };
};


/**
 * SMART FEATURES: Archetypes & Substitutions
 */

// Basic substitution map by role
const CARD_SUBSTITUTIONS: Record<string, string[]> = {
  'little-prince': ['musketeer', 'dart-goblin', 'archer-queen', 'magic-archer'],
  'archer-queen': ['musketeer', 'little-prince', 'magic-archer'],
  'monk': ['knight', 'valkyrie', 'mini-pekka'],
  'skeleton-king': ['valkyrie', 'knight', 'mighty-miner'],
  'mighty-miner': ['valkyrie', 'mini-pekka', 'knight'],
  'golden-knight': ['knight', 'valkyrie', 'bandit'],
  'log': ['barbarian-barrel', 'zap', 'snowball', 'arrows'],
  'zap': ['snowball', 'log', 'arrows'],
  'fireball': ['poison', 'arrows'],
  'poison': ['fireball'],
  'knight': ['valkyrie', 'ice-golem'],
  'valkyrie': ['knight', 'dark-prince'],
  'hog-rider': ['ram-rider', 'royal-hogs'],
  'goblin-barrel': ['log', 'barbarian-barrel'],
  'tornado': ['poison', 'arrows'],
};

export const getSubstitutions = (slug: string): string[] => {
  return CARD_SUBSTITUTIONS[slug] || [];
};

export const detectArchetype = (cards: Card[]): string => {
  const slugs = cards.map(c => getCardSlug(c.name));
  
  if (slugs.includes('hog-rider') && cards.reduce((acc, c) => acc + c.level, 0) / 8 <= 3.1) return 'Hog Cycle';
  if (slugs.includes('x-bow')) return 'X-Bow Control';
  if (slugs.includes('golem')) return 'Golem Beatdown';
  if (slugs.includes('lavahound') && slugs.includes('clone')) return 'Lava Clone';
  if (slugs.includes('lavahound')) return 'LavaLoon';
  if (slugs.includes('miner') && slugs.includes('poison')) return 'Miner Poison';
  if (slugs.includes('graveyard') && slugs.includes('poison')) return 'Splashyard';
  if (slugs.includes('graveyard')) return 'Graveyard Control';
  if (slugs.includes('goblin-barrel') && slugs.includes('princess')) return 'Log Bait';
  if (slugs.includes('royal-giant')) return 'Royal Giant';
  if (slugs.includes('battle-ram') && slugs.includes('pekka')) return 'Pekka Bridge Spam';
  if (slugs.includes('goblin-giant')) return 'Goblin Giant Sparky';
  if (slugs.includes('balloon') && slugs.includes('lumberjack')) return 'LumberLoon';
  
  return 'Control / Midrange'; // Default fallback
};

const CARD_ELIXIR_COSTS: Record<string, number> = {
  'skeletons': 1, 'ice-spirit': 1, 'fire-spirit': 1, 'electro-spirit': 1, 'heal-spirit': 1,
  'goblins': 2, 'spear-goblins': 2, 'zap': 2, 'giant-snowball': 2, 'bats': 2, 'log': 2, 'barbarian-barrel': 2, 'wall-breakers': 2, 'miner': 3, 'princess': 3,
  'knight': 3, 'archers': 3, 'minions': 3, 'bomber': 2, 'arrows': 3, 'cannon': 3, 'tombstone': 3, 'skeleton-barrel': 3, 'goblin-gang': 3, 'dart-goblin': 3, 'skeleton-army': 3, 'guards': 3, 'ice-golem': 2, 'mega-minion': 3, 'bandit': 3, 'royal-ghost': 3, 'fisherman': 3, 'earthquake': 2, 'firecracker': 3, 'elixir-golem': 8,
  'valkyrie': 4, 'musketeer': 4, 'mini-pekka': 4, 'hog-rider': 4, 'fireball': 4, 'poison': 4, 'furnace': 3, 'flying-machine': 3, 'battle-ram': 4, 'zappies': 4, 'bomb-tower': 3, 'tesla': 4, 'magic-archer': 4, 'hunter': 4, 'night-witch': 4, 'lumberjack': 4, 'dark-prince': 4, 'baby-dragon': 4, 'skeleton-dragons': 3,
  'giant': 5, 'goblin-hut': 5, 'inferno-tower': 5, 'wizard': 5, 'witch': 5, 'balloon': 5, 'prince': 5, 'executioner': 5, 'cannon-cart': 5, 'ram-rider': 5, 'royal-hogs': 5, 'bowler': 5, 'graveyard': 5,
  'royal-giant': 6, 'elite-barbarians': 6, 'rocket': 6, 'lightning': 6, 'x-bow': 6, 'sparky': 6, 'goblin-giant': 6, 'barbarians': 5, 'minion-horde': 5,
  'pekka': 7, 'mega-knight': 7, 'lava-hound': 7, 'royal-recruits': 7,
  'golem': 8, 'three-musketeers': 9, 'mirror': 0, 'clone': 3, 'tornado': 3,
  'little-prince': 3, 'archer-queen': 5, 'skeleton-king': 4, 'mighty-miner': 4, 'golden-knight': 4, 'monk': 5
};

export const getCardElixirCost = (card: Card): number => {
  if ((card as any).elixirCost !== undefined) return (card as any).elixirCost;
  const slug = getCardSlug(card.name);
  return CARD_ELIXIR_COSTS[slug] || 3; // Fallback to 3 if unknown
};

export const getDeckAverageElixir = (cards: Card[]): number => {
  const deckCards = cards.filter(c => c && c.id < 68000000).slice(0, 8);
  if (deckCards.length === 0) return 0;
  const total = deckCards.reduce((acc, card) => acc + getCardElixirCost(card), 0);
  return total / deckCards.length;
};

// Matchup Mock logic based on archetypes
const ARCHETYPE_MATCHUPS: Record<string, { strong: string[], weak: string[] }> = {
  'Hog Cycle': { strong: ['Golem Beatdown', 'Pekka Bridge Spam'], weak: ['Splashyard', 'LavaLoon'] },
  'Golem Beatdown': { strong: ['X-Bow Control', 'Log Bait'], weak: ['Pekka Bridge Spam', 'Miner Poison'] },
  'Log Bait': { strong: ['Pekka Bridge Spam', 'Graveyard Control'], weak: ['X-Bow Control', 'Splashyard'] },
  'X-Bow Control': { strong: ['Log Bait', 'Splashyard'], weak: ['Golem Beatdown', 'Royal Giant'] },
  'LavaLoon': { strong: ['Graveyard Control', 'Log Bait'], weak: ['X-Bow Control', 'Miner Poison'] },
  'Pekka Bridge Spam': { strong: ['Golem Beatdown', 'Royal Giant'], weak: ['Log Bait', 'LavaLoon'] },
  'Splashyard': { strong: ['Hog Cycle', 'Log Bait'], weak: ['LavaLoon', 'Pekka Bridge Spam'] },
  'Miner Poison': { strong: ['Golem Beatdown', 'LavaLoon'], weak: ['Graveyard Control', 'X-Bow Control'] },
  'Royal Giant': { strong: ['X-Bow Control', 'Miner Poison'], weak: ['Pekka Bridge Spam', 'Log Bait'] },
  'Control / Midrange': { strong: ['Hog Cycle'], weak: ['Golem Beatdown'] }
};

export const getArchetypeMatchups = (archetype: string) => {
  return ARCHETYPE_MATCHUPS[archetype] || ARCHETYPE_MATCHUPS['Control / Midrange'];
};

export const getCardSlug = (name: string) => {
  if (!name) return 'unknown';
  return name.toLowerCase()
    .replace(/\./g, '')
    .replace(/ /g, '-')
    .replace('mini-p-e-k-k-a', 'mini-pekka')
    .replace('p-e-k-k-a', 'pekka')
    .replace('evolved-', '')
    .replace('-evolved', '')
    .replace('evolution-', '')
    .replace('-evolution', '')
    .replace('hero-', '')
    .replace('-hero', '')
    .replace('evo-', '')
    .replace('-evo', '');
};

export const getCardIcon = (card: Card, isHero: boolean, isEvo: boolean) => {
  if (!card) return 'https://cdn.royaleapi.com/static/img/cards-150/unknown.png';
  
  const slug = getCardSlug(card.name);

  // 1. Check for explicit variant URLs in payload or dynamic global registry
  const registryIcons = globalIconRegistry[card.id] || {};
  const heroUrl = card.iconUrls?.heroMedium || registryIcons.heroMedium;
  const evoUrl = card.iconUrls?.evolutionMedium || registryIcons.evolutionMedium;
  
  if (isHero && heroUrl) return heroUrl;
  if (isEvo && evoUrl) return evoUrl;
  
  // 2. Check if the standard medium icon already matches the requested form
  const mediumIcon = card.iconUrls?.medium || registryIcons.medium || '';
  if (isHero && mediumIcon.toLowerCase().includes('hero')) return mediumIcon;
  if (isEvo && (mediumIcon.toLowerCase().includes('evo') || mediumIcon.toLowerCase().includes('ev1') || mediumIcon.toLowerCase().includes('evolution'))) return mediumIcon;
  
  // 3. Fallback to standard RoyaleAPI CDN patterns dynamically
  const BASE_CDN = "https://cdn.royaleapi.com/static/img/cards-150";
  
  if (isHero) return `${BASE_CDN}/${slug}-hero.png`;
  if (isEvo) return `${BASE_CDN}/${slug}-ev1.png`;
  
  return mediumIcon || `${BASE_CDN}/${slug}.png`;
};


