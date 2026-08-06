import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CardImage } from './CardImage';
import type { MetaDeck } from '../App';
import type { PlayerProfile, Card } from '../types/clashRoyale';
import { hasEvoAvailable, hasHeroAvailable, getCardIcon, getSubstitutions, isEvoUnlocked, isHeroVariantUnlocked } from '../types/clashRoyale';
import { TrendingUp, RefreshCw, Trophy, Filter, X, Sparkles, Crown, Copy, LayoutDashboard, Gem, Swords, ArrowUp, ArrowDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DeckCard } from './ui/DeckCard';
import { useWarDecks } from '../hooks/useWarDecks';

interface FilterItem {
  id: number;
  name: string;
  icon: string;
  isEvoFilter: boolean;
  rarity: string;
}

interface DeckBuilderProps {
  profile: PlayerProfile;
  apiKey: string;
  getDisplayLevel: (card: Card) => number;
  cachedDecks: MetaDeck[] | null;
  onAnalysisStart: () => void;
  isLoading: boolean;
  progress: number;
  allGameCards: Card[];
  isMaxPotentialMode: boolean;
  setIsMaxPotentialMode: (val: boolean) => void;
  rawDeckCounts?: any;
  magicItems?: any;
  getRarityClass?: (card: Card) => string;
}

// Meta Deck Builder Component
export const DeckBuilder: React.FC<DeckBuilderProps> = ({ 
  profile, 
  getDisplayLevel, 
  cachedDecks, 
  onAnalysisStart, 
  isLoading, 
  progress,
  allGameCards,
  isMaxPotentialMode,
  setIsMaxPotentialMode,
  rawDeckCounts,
  magicItems,
  getRarityClass
}) => {
  type SelectedFilterItem = FilterItem & { mode: 'include' | 'exclude' };
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilterItem[]>([]);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [expandedScoreIdx, setExpandedScoreIdx] = useState<number | null>(null);
  const deckPageSize = useMemo(() => window.matchMedia('(max-width: 760px)').matches ? 6 : 10, []);
  const [visibleCount, setVisibleCount] = useState(deckPageSize);
  const [sortCriterion, setSortCriterion] = useState<string>('winRate');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const isTouchDevice = useMemo(() => {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }, []);

  const [showWarDecks, setShowWarDecks] = useState(false);


  const [warUseGold, setWarUseGold] = useState(false);
  const [warUseGems, setWarUseGems] = useState(false);
  const [warUseWildcards, setWarUseWildcards] = useState(false);
  const [warUseEvoShards, setWarUseEvoShards] = useState(false);
  const [warUseHeroCoins, setWarUseHeroCoins] = useState(false);

  const bestWarDecks = useWarDecks(
    profile,
    magicItems,
    rawDeckCounts,
    getRarityClass,
    getDisplayLevel,
    warUseGold,
    warUseGems,
    warUseWildcards,
    warUseEvoShards,
    warUseHeroCoins
  );

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(deckPageSize);
  }, [selectedFilters, deckPageSize]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + deckPageSize);
  };

  const toggleFilter = (item: FilterItem, action: 'cycle' | 'include' | 'exclude' | 'remove' = 'cycle') => {
    setSelectedFilters(prev => {
      const existingIdx = prev.findIndex(f => f.id === item.id && f.isEvoFilter === item.isEvoFilter);
      
      if (action === 'remove') {
        if (existingIdx >= 0) return prev.filter((_, idx) => idx !== existingIdx);
        return prev;
      }

      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const newFilters = [...prev];

        if (action === 'cycle') {
          if (existing.mode === 'include') {
            newFilters[existingIdx] = { ...existing, mode: 'exclude' };
            return newFilters;
          } else {
            return prev.filter((_, idx) => idx !== existingIdx);
          }
        } else if (action === 'include') {
          if (existing.mode === 'include') {
            return prev.filter((_, idx) => idx !== existingIdx);
          } else {
            newFilters[existingIdx] = { ...existing, mode: 'include' };
            return newFilters;
          }
        } else if (action === 'exclude') {
          if (existing.mode === 'exclude') {
            return prev.filter((_, idx) => idx !== existingIdx);
          } else {
            newFilters[existingIdx] = { ...existing, mode: 'exclude' };
            return newFilters;
          }
        }
      }

      if (action === 'exclude') {
        return [...prev, { ...item, mode: 'exclude' }];
      }
      return [...prev, { ...item, mode: 'include' }]; 
    });
  };

  const generateDeckLink = useCallback((deck: MetaDeck): string => {
    const { cards, towerTroopId } = deck;
    const deckCards = cards.filter(c => c && c.id && c.id < 68000000).slice(0, 8);
    const deckIds = deckCards.map(c => c.id).join(';');
    
    let towerId = '159000000';
    if (towerTroopId) {
      const tidStr = towerTroopId.toString();
      if (tidStr.startsWith('68')) {
        towerId = tidStr.replace('68', '159');
      } else if (!tidStr.startsWith('159')) {
        towerId = '159000000';
      } else {
        towerId = tidStr;
      }
    }

    const deepLinkParams = `deck=${deckIds}&l=MetaArchetype&tt=${towerId}`;
    return `https://link.clashroyale.com/en/?clashroyale://copyDeck?${deepLinkParams}`;
  }, []);

  const handleCopyDeck = useCallback((deck: MetaDeck, index: number) => {
    const finalLink = generateDeckLink(deck);

    navigator.clipboard.writeText(finalLink).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });

    window.open(finalLink, '_self');
  }, [generateDeckLink]);

  const handleShowQr = useCallback((deck: MetaDeck) => {
    setQrModalUrl(generateDeckLink(deck));
  }, [generateDeckLink]);

  const getCardSubstitutesData = useCallback((cardName: string) => {
    const slug = cardName.toLowerCase().replace(/ /g, '-').replace(/\./g, '');
    const subs = getSubstitutions(slug);
    if (subs.length === 0) return null;
    
    // Find the first sub that the user actually owns
    for (const subSlug of subs) {
      const ownedCard = profile.cards.find(c => c.name.toLowerCase().replace(/ /g, '-').replace(/\./g, '') === subSlug);
      if (ownedCard) {
        return { name: ownedCard.name, icon: getCardIcon(ownedCard, false, false) };
      }
    }
    
    // If none owned, just return the first one as a generic suggestion
    const firstSubCard = allGameCards.find(c => c.name.toLowerCase().replace(/ /g, '-').replace(/\./g, '') === subs[0]);
    if (firstSubCard) {
      return { name: firstSubCard.name, icon: getCardIcon(firstSubCard, false, false) };
    }
    
    return null;
  }, [profile.cards, allGameCards]);

  const { filteredRecommendations } = useMemo(() => {
    if (!cachedDecks || cachedDecks.length === 0) return { cardFilteredDecks: [], filteredRecommendations: [] };
    
    let finalFiltered = cachedDecks
      .filter(deck => {
        const includes = selectedFilters.filter(f => f.mode === 'include');
        const hasAllIncludes = includes.every(filter => {
          const matchesCard = (c: Card, filterItem: any) => {
            if (Number(c.id) === filterItem.id) return true;
            // Cross-reference fallback for separate variant cards
            const cName = (c.name || '').toLowerCase();
            const fName = (filterItem.name || '').toLowerCase().replace(' (hero)', '');
            if (filterItem.rarity === 'hero' && (cName === `hero ${fName}` || cName === `${fName} hero`)) return true;
            if (filterItem.isEvoFilter && (cName === `evo ${fName}` || cName === `evolved ${fName}` || cName === `${fName} evo` || cName === `${fName} evolution`)) return true;
            return false;
          };

          if (filter.isEvoFilter) {
            return deck.cards.some(c => matchesCard(c, filter) && isEvoUnlocked(c));
          } else if (filter.rarity === 'hero') {
            return deck.cards.some(c => matchesCard(c, filter) && isHeroVariantUnlocked(c));
          } else {
            return deck.cards.some(c => matchesCard(c, filter));
          }
        });

        if (!hasAllIncludes) return false;

        const excludes = selectedFilters.filter(f => f.mode === 'exclude');
        const hasAnyExclude = excludes.some(filter => {
          const matchesCard = (c: Card, filterItem: any) => {
            if (Number(c.id) === filterItem.id) return true;
            const cName = (c.name || '').toLowerCase();
            const fName = (filterItem.name || '').toLowerCase().replace(' (hero)', '');
            if (filterItem.rarity === 'hero' && (cName === `hero ${fName}` || cName === `${fName} hero`)) return true;
            if (filterItem.isEvoFilter && (cName === `evo ${fName}` || cName === `evolved ${fName}` || cName === `${fName} evo` || cName === `${fName} evolution`)) return true;
            return false;
          };

          if (filter.isEvoFilter) {
            return deck.cards.some(c => matchesCard(c, filter) && isEvoUnlocked(c));
          } else if (filter.rarity === 'hero') {
            return deck.cards.some(c => matchesCard(c, filter) && isHeroVariantUnlocked(c));
          } else {
            return deck.cards.some(c => matchesCard(c, filter));
          }
        });

        if (hasAnyExclude) return false;

        return true;
      });

    finalFiltered.sort((a, b) => {
        const aDisplayScore = Math.round(a.score);
        const bDisplayScore = Math.round(b.score);
        
        if (aDisplayScore !== bDisplayScore) return b.score - a.score;
        
        const dir = sortDirection === 'desc' ? 1 : -1;
        
        if (sortCriterion === 'winRate') {
            const aVal = a.winRate || 0;
            const bVal = b.winRate || 0;
            if (aVal !== bVal) return (bVal - aVal) * dir;
        } else if (sortCriterion === 'elixir') {
            const aVal = a.elixirCost || 0;
            const bVal = b.elixirCost || 0;
            if (aVal !== bVal) return (bVal - aVal) * dir;
        } else if (sortCriterion === 'gems') {
            const aVal = a.gemsUsed || 0;
            const bVal = b.gemsUsed || 0;
            if (aVal !== bVal) return (bVal - aVal) * dir;
        } else if (sortCriterion === 'gold') {
            const aVal = a.virtualUpgrades?.reduce((sum: number, u: any) => sum + u.gold, 0) || 0;
            const bVal = b.virtualUpgrades?.reduce((sum: number, u: any) => sum + u.gold, 0) || 0;
            if (aVal !== bVal) return (bVal - aVal) * dir;
        } else if (sortCriterion === 'affinity') {
            if (a.score !== b.score) return (b.score - a.score) * dir;
        } else if (sortCriterion === 'evoShards') {
            const aVal = a.evoShardsUsed?.reduce((sum: number, e: any) => sum + e.count, 0) || 0;
            const bVal = b.evoShardsUsed?.reduce((sum: number, e: any) => sum + e.count, 0) || 0;
            if (aVal !== bVal) return (bVal - aVal) * dir;
        } else if (sortCriterion === 'wildCards') {
            const aVal = Object.values(a.wildcardsUsed || {}).reduce((sum: number, count: any) => sum + count, 0);
            const bVal = Object.values(b.wildcardsUsed || {}).reduce((sum: number, count: any) => sum + count, 0);
            if (aVal !== bVal) return (bVal - aVal) * dir;
        } else if (sortCriterion === 'medals') {
            const aVal = a.maxMedals || 0;
            const bVal = b.maxMedals || 0;
            if (aVal !== bVal) return (bVal - aVal) * dir;
        }
        
        const aCost = a.totalCostScore || 0;
        const bCost = b.totalCostScore || 0;
        if (aCost !== bCost) return aCost - bCost;
        
        return (b.maxMedals || 0) - (a.maxMedals || 0);
    });

    return { 
      filteredRecommendations: selectedFilters.length === 0 ? finalFiltered : finalFiltered.slice(0, 100) 
    };
  }, [cachedDecks, selectedFilters, sortCriterion, sortDirection]);
  const sections = useMemo(() => {
    const evos: FilterItem[] = [];
    const champions: FilterItem[] = [];
    const heroes: FilterItem[] = [];
    const normal: FilterItem[] = [];

    const rarityOrder: Record<string, number> = {
      'common': 1, 'rare': 2, 'epic': 3, 'legendary': 4, 'champion': 5, 'hero': 6
    };

    if (Array.isArray(allGameCards)) {
      allGameCards.forEach(c => {
        if (!c) return;
        const iconUrl = c.iconUrls?.medium || '';
        const rarity = (c.rarity || 'common').toLowerCase();
        
        // DYNAMIC DETECTION (Strict categorization)
        const isChampRarity = rarity === 'champion';
        const canHaveEvo = hasEvoAvailable(c);
        const canHaveHero = hasHeroAvailable(c) && !isChampRarity;

        if (canHaveEvo) {
          const evoIcon = getCardIcon(c, false, true);
          evos.push({ id: c.id, icon: evoIcon, name: c.name, isEvoFilter: true, rarity });
        }
        
        if (isChampRarity) {
          champions.push({ 
            id: c.id, 
            icon: iconUrl, 
            name: c.name, 
            isEvoFilter: false, 
            rarity: 'champion' 
          });
        }

        if (canHaveHero) {
          const heroIcon = getCardIcon(c, true, false);
          heroes.push({ 
            id: c.id, 
            icon: heroIcon, 
            name: c.name.toLowerCase().includes('hero') ? c.name : `${c.name} (Hero)`, 
            isEvoFilter: false, 
            rarity: 'hero' 
          });
        }
        
        if (!isChampRarity) {
          normal.push({ id: c.id, icon: iconUrl, name: c.name, isEvoFilter: false, rarity });
        }
      });
    }

    return {
      evos: evos.sort((a, b) => a.name.localeCompare(b.name)),
      champions: champions.sort((a, b) => a.name.localeCompare(b.name)),
      heroes: heroes.sort((a, b) => a.name.localeCompare(b.name)),
      normal: normal.sort((a, b) => {
        const rA = rarityOrder[a.rarity.toLowerCase()] || 0;
        const rB = rarityOrder[b.rarity.toLowerCase()] || 0;
        if (rA !== rB) return rA - rB;
        return a.name.localeCompare(b.name);
      })
    };
  }, [allGameCards]);

  const renderFilterGrid = (items: FilterItem[], title: string, Icon: any, color: string) => {
    if (items.length === 0) return null;
    return (
      <div className="filter-section-group" key={title}>
        <div className="section-title" style={{ color }}>
          <Icon size={14} /> {title} ({items.length})
        </div>
        <div className="filter-grid">
          {items.map((c, idx) => {
            const selectedItem = selectedFilters.find(f => f.id === c.id && f.isEvoFilter === c.isEvoFilter);
            
            const cardRarity = (c.name && c.name.toLowerCase().includes('ronin')) ? 'legendary' : (c.rarity || 'common').toLowerCase();
            const isRonin = c.name && c.name.toLowerCase().includes('ronin');
            return (
              <div 
                key={`${c.id}-${c.isEvoFilter}-${idx}`} 
                className={`filter-grid-item ${selectedItem ? 'selected' : ''} ${selectedItem?.mode === 'include' ? 'selected-include' : ''} ${selectedItem?.mode === 'exclude' ? 'selected-exclude' : ''} ${c.isEvoFilter ? 'evo' : ''} ${cardRarity === 'legendary' ? 'card-legendary' : ''} ${isRonin ? 'card-ronin' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  toggleFilter(c, isTouchDevice ? 'cycle' : 'include');
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isTouchDevice) toggleFilter(c, 'exclude');
                }}
                title={c.isEvoFilter ? `Evolved ${c.name}` : c.name}
              >
                <CardImage src={c.icon} cardName={c.name} alt={c.isEvoFilter ? `Evolved ${c.name}` : c.name} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const totalWarGold = useMemo(() => bestWarDecks.reduce((sum, deck) => sum + (deck.virtualUpgrades || []).reduce((g: any, u: any) => g + u.gold, 0), 0), [bestWarDecks]);
  const totalWarGems = useMemo(() => bestWarDecks.reduce((sum, deck) => sum + (deck.gemsUsed || 0), 0), [bestWarDecks]);
  const totalWarWildcards = useMemo(() => bestWarDecks.reduce((sum, deck) => sum + ((deck.wildcardsUsed?.common || 0) + (deck.wildcardsUsed?.rare || 0) + (deck.wildcardsUsed?.epic || 0) + (deck.wildcardsUsed?.legendary || 0) + (deck.wildcardsUsed?.champion || 0)), 0), [bestWarDecks]);
  const totalWarEvoShards = useMemo(() => bestWarDecks.reduce((sum, deck) => sum + (deck.evoShardsUsed || []).reduce((c: any, e: any) => c + e.count, 0), 0), [bestWarDecks]);
  const totalWarHeroCoins = useMemo(() => bestWarDecks.reduce((sum, deck) => sum + (deck.heroCoinsUsed || []).reduce((c: any, e: any) => c + e.count, 0), 0), [bestWarDecks]);

  return (
    <div className="deck-builder">
      <div 
        className="war-banner" 
        onClick={() => setShowWarDecks(!showWarDecks)} 
        style={{ 
          background: 'linear-gradient(135deg, #7f1d1d, #ef4444)', 
          padding: '1rem', 
          borderRadius: '1rem', 
          margin: '0.5rem 1rem 1rem 1rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          cursor: 'pointer', 
          boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '50%' }}>
            <Swords color="white" size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Clan War Decks</h3>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>Find the best 4 non-overlapping decks</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', width: '32px', height: '32px', borderRadius: '50%' }}>
          {showWarDecks ? <ArrowUp color="white" size={18} /> : <ArrowDown color="white" size={18} />}
        </div>
      </div>

      {showWarDecks && (
        <div className="war-toggles-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', margin: '0 1rem 1.5rem 1rem', padding: '1rem', background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
          <div style={{ width: '100%', textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Enable resources usage for War Decks
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              onClick={() => setWarUseGold(!warUseGold)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: `1px solid ${warUseGold ? '#fbbf24' : 'var(--border)'}`, background: warUseGold ? 'rgba(251, 191, 36, 0.1)' : 'transparent', color: warUseGold ? '#fbbf24' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
            >
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <span style={{ fontSize: '10px', color: '#000', lineHeight: 1 }}>💰</span>
              </div>
              Gold
            </button>
            {warUseGold && totalWarGold > 0 && <span style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem' }}>Used: {totalWarGold}</span>}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              onClick={() => setWarUseGems(!warUseGems)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: `1px solid ${warUseGems ? '#10b981' : 'var(--border)'}`, background: warUseGems ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: warUseGems ? '#10b981' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
            >
              <Gem size={16} /> Gems
            </button>
            {warUseGems && totalWarGems > 0 && <span style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>Used: {totalWarGems}</span>}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              onClick={() => setWarUseWildcards(!warUseWildcards)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: `1px solid ${warUseWildcards ? '#3b82f6' : 'var(--border)'}`, background: warUseWildcards ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: warUseWildcards ? '#3b82f6' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
            >
              <Copy size={16} /> Wildcards
            </button>
            {warUseWildcards && totalWarWildcards > 0 && <span style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.25rem' }}>Used: {totalWarWildcards}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              onClick={() => setWarUseEvoShards(!warUseEvoShards)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: `1px solid ${warUseEvoShards ? '#d946ef' : 'var(--border)'}`, background: warUseEvoShards ? 'rgba(217, 70, 239, 0.1)' : 'transparent', color: warUseEvoShards ? '#d946ef' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
            >
              <Sparkles size={16} /> Evo Shards
            </button>
            {warUseEvoShards && totalWarEvoShards > 0 && <span style={{ fontSize: '0.75rem', color: '#d946ef', marginTop: '0.25rem' }}>Used: {totalWarEvoShards}</span>}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              onClick={() => setWarUseHeroCoins(!warUseHeroCoins)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: `1px solid ${warUseHeroCoins ? '#f59e0b' : 'var(--border)'}`, background: warUseHeroCoins ? 'rgba(245, 158, 11, 0.1)' : 'transparent', color: warUseHeroCoins ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
            >
              <Crown size={16} /> Hero Coins
            </button>
            {warUseHeroCoins && totalWarHeroCoins > 0 && <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>Used: {totalWarHeroCoins}</span>}
          </div>
        </div>
      )}

      {!showWarDecks && (
        <div className="mode-toggle-container" style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', borderRadius: '2rem', padding: '0.25rem', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setIsMaxPotentialMode(false)}
              style={{ padding: '0.5rem 1.5rem', borderRadius: '2rem', border: 'none', background: !isMaxPotentialMode ? 'var(--primary)' : 'transparent', color: !isMaxPotentialMode ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Play Now
            </button>
            <button 
              onClick={() => setIsMaxPotentialMode(true)}
              style={{ padding: '0.5rem 1.5rem', borderRadius: '2rem', border: 'none', background: isMaxPotentialMode ? 'var(--evo-purple)' : 'transparent', color: isMaxPotentialMode ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <Sparkles size={16} /> Max Potential
            </button>
          </div>
        </div>
      )}
      
      {!showWarDecks && (
        <>
        <div className="builder-header-simple">
        <div 
          className={`filter-preview-trigger ${isFilterExpanded ? 'active' : ''}`}
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
        >
          <div className="preview-content">
            <div className="preview-info">
              <div className="preview-label">
                <Filter size={18} />
                <span>FILTER BY CARDS</span>
              </div>
              <div className="preview-status">
                {selectedFilters.length > 0 && (
                  <span className="active-badge">{selectedFilters.length} SELECTED</span>
                )}
              </div>
            </div>
            
            <div className="visual-projection">
              {allGameCards.slice(0, 28).map((c, i) => (
                <img key={i} src={getCardIcon(c, false, false)} alt="" className="tiny-card-asset" loading="lazy" />
              ))}
              <div className="projection-overlay"></div>
            </div>
          </div>
          <div className="expand-chevron">
            {isFilterExpanded ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
          </div>
        </div>
      </div>

      <div className={`filter-animation-wrapper ${isFilterExpanded ? 'expanded' : ''}`}>
        {Array.isArray(allGameCards) && allGameCards.length > 0 && (
          <div className="card-filter-grid-section">
            <div className="filter-header-minimal">
              <div className="active-filters-container">
                <div className="active-filters-label">
                  <Sparkles size={14} /> ACTIVE FILTERS
                </div>
                
                <div className="active-filters-visual-stack">
                  {selectedFilters.map((f) => (
                    <div 
                      key={`${f.id}-${f.isEvoFilter}`} 
                      className={`active-filter-icon-wrapper ${f.mode === 'exclude' ? 'excluded' : 'included'}`}
                      onClick={() => toggleFilter(f, 'remove')}
                      title={`Remove ${f.name}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <CardImage src={f.icon} cardName={f.name} />
                    </div>
                  ))}
                </div>
              </div>

              {selectedFilters.length > 0 && (
                <button onClick={() => { setSelectedFilters([]); }} className="clear-btn">
                  <X size={12} /> Reset
                </button>
              )}
            </div>
            
            <div className="filter-legend" style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(15,23,42,0.5)', padding: '0.5rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
              {isTouchDevice ? (
                <>
                  <span style={{ fontWeight: 600 }}>Tap to cycle:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div>
                    <span>Include</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></div>
                    <span>Exclude</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div>
                    <span>Left Click = Include</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></div>
                    <span>Right Click = Exclude</span>
                  </div>
                </>
              )}
            </div>
            
            <div className="filter-sections-container">
              {renderFilterGrid(sections.evos, "EVOLUTIONS", Sparkles, "var(--evo-purple)")}
              {renderFilterGrid(sections.champions, "CHAMPIONS", Crown, "var(--champion-gold)")}
              {renderFilterGrid(sections.heroes, "HEROES", Crown, "var(--hero-yellow)")}
              {renderFilterGrid(sections.normal, "ALL CARDS", Filter, "var(--text-muted)")}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {!cachedDecks && !isLoading && (
        <div className="start-analysis-container-centered">
          <button onClick={onAnalysisStart} className="big-analysis-btn-premium">
            <TrendingUp size={24} />
            <span>FIND META DECKS</span>
          </button>
        </div>
      )}
      

      
      {isLoading && !cachedDecks && (
        <div className="skeleton-container">
          <div className="analysis-status" style={{ marginBottom: '1.5rem', background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
            <div className="status-main">
              <RefreshCw size={14} className="spin" />
              <span>Analyzing Top 200 Pro Meta...</span>
            </div>
            <span className="status-percent">{progress}%</span>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="deck-suggestion skeleton-deck">
              <div className="deck-header skeleton-pulse" style={{ height: '60px' }}></div>
              <div className="deck-main-content">
                <div className="mini-card-grid">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(j => (
                    <div key={j} className="skeleton-card skeleton-pulse"></div>
                  ))}
                </div>
                <div className="skeleton-stats skeleton-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {cachedDecks ? (
        <div className="recommendations-list" style={{ opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
          {isLoading && (
            <div className="analysis-progress-container" style={{ margin: '1rem 0' }}>
              <div className="analysis-status">
                <div className="status-main">
                  <RefreshCw size={14} className="spin" />
                  <span>REFRESHING META DATA...</span>
                </div>
                <span className="status-percent">{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
          {showWarDecks ? (
            <div className="results-summary-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div className="total-decks-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <Swords size={14} />
                <span>4 DISJOINT DECKS FOR CLAN WARS</span>
              </div>
              <div className="total-decks-badge" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                <Trophy size={14} />
                <span>COMBINED SCORE: {Math.round(bestWarDecks.reduce((sum, d) => sum + d.score, 0))}</span>
              </div>
            </div>
          ) : (
            <div className="results-summary-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="total-decks-badge">
                <LayoutDashboard size={14} />
                <span>TOTAL DECKS: {filteredRecommendations.length} {filteredRecommendations.length > visibleCount && `(SHOWING ${visibleCount})`}</span>
              </div>
              
              <div className="deck-sorting-controls">
                <span className="sorting-label">TIE-BREAKER</span>
                <select 
                  value={sortCriterion}
                  onChange={(e) => setSortCriterion(e.target.value)}
                  className="premium-select"
                >
                  <option value="winRate">Win Rate</option>
                  <option value="elixir">Avg Elixir</option>
                  <option value="medals">Medals</option>
                  <option value="gems">Gems Cost</option>
                  <option value="gold">Gold Cost</option>
                  <option value="affinity">Exact Affinity</option>
                  <option value="evoShards">Evo Shards Used</option>
                  <option value="wildCards">Wildcards Used</option>
                </select>
                <button 
                  onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="sort-dir-btn"
                  title={sortDirection === 'desc' ? 'Descending' : 'Ascending'}
                >
                  {sortDirection === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                </button>
              </div>
            </div>
          )}
          
          {(showWarDecks ? bestWarDecks : filteredRecommendations.slice(0, visibleCount)).map((deck, idx) => (
            <DeckCard 
              key={deck.name || idx}
              deck={deck} 
              idx={idx} 
              profile={profile} 
              expandedScoreIdx={expandedScoreIdx} 
              setExpandedScoreIdx={setExpandedScoreIdx}
              handleCopyDeck={handleCopyDeck}
              handleShowQr={handleShowQr}
              getDisplayLevel={getDisplayLevel}
              getCardSubstitutesData={getCardSubstitutesData}
              copiedIndex={copiedIndex}
            />
          ))}

          {(!showWarDecks && filteredRecommendations.length > visibleCount) && (
            <div className="load-more-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', marginBottom: '3rem' }}>
              <button 
                onClick={handleLoadMore}
                className="action-btn" 
                style={{ padding: '1rem 2.5rem', borderRadius: '3rem', fontSize: '1rem' }}
              >
                <RefreshCw size={18} />
                <span>LOAD MORE DECKS</span>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {qrModalUrl && (
        <div className="qr-modal-overlay" onClick={() => setQrModalUrl(null)}>
          <div className="qr-modal-content" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>Scan to Copy Deck</h3>
              <button onClick={() => setQrModalUrl(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
              <QRCodeSVG value={qrModalUrl} size={256} level="H" includeMargin={false} fgColor="#000000" bgColor="#ffffff" />
            </div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              Open your camera or a QR scanner app on your phone to copy this deck directly into Clash Royale.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};


