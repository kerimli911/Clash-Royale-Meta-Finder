import { useState, useMemo, useEffect, useCallback } from 'react';
import type { PlayerProfile, Card, MagicItems } from '../types/clashRoyale';
import { getPathOfLegendSeasons, fetchRankings, getBattleLog, getPlayerDeck } from '../services/royaleApi';
import { isEvoUnlocked, isHeroVariantUnlocked, hasHeroAvailable, hasEvoAvailable, isChampion, getDeckAverageElixir, getCardsToNextLevel, getVirtualLevelAndGold, registerCardIcons, getCardIcon } from '../types/clashRoyale';
import type { MetaDeck } from '../App'; // We might need to move MetaDeck interface to types

export const useMetaInsights = (
  profile: PlayerProfile | null,
  INTEGRATED_API_KEY: string,
  magicItems: MagicItems,
  isMaxPotentialMode: boolean,
  getDisplayLevel: (card: Card) => number,
  getRarityClass: (card: Card) => string
) => {
  const [metaDecksCache, setMetaDecksCache] = useState<MetaDeck[] | null>(null);
  const [isMetaLoading, setIsMetaLoading] = useState(false);
  const [metaProgress, setMetaProgress] = useState(0);
  const [rawDeckCounts, setRawDeckCounts] = useState<any>(null);

  const performMetaAnalysis = useCallback(async (customProfile?: PlayerProfile) => {
    const activeProfile = customProfile || profile;
    if (!activeProfile) return;
    setIsMetaLoading(true);
    setMetaProgress(0);
    
    try {
      let seasonId: string | undefined;
      let prevSeasonId: string | undefined;
      
      try {
        const seasons = await getPathOfLegendSeasons(INTEGRATED_API_KEY);
        if (seasons.items && seasons.items.length > 0) {
          seasonId = seasons.items[seasons.items.length - 1].id;
          if (seasons.items.length > 1) {
            prevSeasonId = seasons.items[seasons.items.length - 2].id;
          }
        }
      } catch (e) { console.warn('[Meta] Seasons lookup failed'); }

      const pathsToTry = [
        '/locations/global/pathoflegend/players?limit=100',
        seasonId ? `/locations/global/rankings/seasons/${seasonId}/players?limit=100` : null,
        prevSeasonId ? `/locations/global/rankings/seasons/${prevSeasonId}/players?limit=100` : null,
        seasonId ? `/locations/global/seasons/${seasonId}/rankings/players?limit=100` : null,
        prevSeasonId ? `/locations/global/seasons/${prevSeasonId}/rankings/players?limit=100` : null,
        '/locations/global/rankings/players?limit=100',
        '/locations/57000000/rankings/players?limit=100'
      ].filter(Boolean) as string[];
      
      let rankingsData: any = null;

      for (const path of pathsToTry) {
        try {
          const data = await fetchRankings(INTEGRATED_API_KEY, path);
          if (data && data.items && data.items.length > 0) {
            rankingsData = data;
            break;
          }
        } catch (e) { console.warn(`[Meta] Error on path: ${path}`); }
      }

      if (!rankingsData) throw new Error('Could not find any active rankings.');

      const playersToFetch = rankingsData.items.slice(0, 200);
      const decksWithRatings: { deck: Card[], towerTroopId?: number, rating: number, playerName: string, wins: number, totalMatches: number }[] = [];
      const batchSize = 20;
      
      const extractDeckFromLog = (log: any[]) => {
        const recentMatch = log.find((entry: any) => entry.type === 'pathOfLegend' || entry.type === 'PvP');
        if (!recentMatch || !recentMatch.team || !recentMatch.team[0]) return null;
        const allCards = recentMatch.team[0].cards || [];
        registerCardIcons(allCards);
        const towerTroop = allCards.find((c: any) => c.id >= 68000000);
        
        const recentDeckIds = allCards.filter((c: any) => c.id < 68000000).map((c: any) => c.id).sort().join(',');
        let wins = 0;
        let totalMatches = 0;
        
        log.forEach((entry: any) => {
            if (entry.type === 'pathOfLegend' || entry.type === 'PvP') {
                if (entry.team && entry.team[0] && entry.team[0].cards) {
                    const entryDeckIds = entry.team[0].cards.filter((c: any) => c.id < 68000000).map((c: any) => c.id).sort().join(',');
                    if (entryDeckIds === recentDeckIds) {
                        totalMatches++;
                        const teamCrowns = entry.team[0].crowns || 0;
                        const oppCrowns = (entry.opponent && entry.opponent[0] && entry.opponent[0].crowns) ? entry.opponent[0].crowns : 0;
                        if (teamCrowns > oppCrowns) wins++;
                    }
                }
            }
        });
        
        const deck = allCards.filter((c: any) => c.id < 68000000).slice(0, 8).map((c: any, index: number) => {
          let forcedForm: 'hero' | 'evo' | 'normal' = 'normal';
          const isChamp = isChampion(c);
          
          if (index < 3 && !isChamp) {
            if (isHeroVariantUnlocked(c)) {
              forcedForm = 'hero';
            } else if (isEvoUnlocked(c)) {
              forcedForm = 'evo';
            } else if (hasHeroAvailable(c)) {
              forcedForm = 'hero';
            } else if (hasEvoAvailable(c)) {
              forcedForm = 'evo';
            }
          }

          return { 
            ...c, 
            _forceForm: forcedForm, 
            key: c.key, 
            form: c.form,
            activeForm: c.activeForm,
            slot: c.slot
          };
        });

        return { deck, towerTroopId: towerTroop?.id, wins, totalMatches };
      };

      for (let i = 0; i < playersToFetch.length; i += batchSize) {
        const batch = playersToFetch.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (p: any) => {
          try { 
            const pElo = Number(p.eloRating || 0);
            const pTrophy = Number(p.trophies || 0);
            const proRating = pElo > 0 ? pElo : pTrophy;
            const proName = p.name || "Unknown Pro";

            const log = await getBattleLog(p.tag, INTEGRATED_API_KEY);
            const logData = log ? extractDeckFromLog(log) : null;
            if (logData && logData.deck.length === 8) return { ...logData, rating: proRating, playerName: proName };
            
            const deck = await getPlayerDeck(p.tag, INTEGRATED_API_KEY);
            if (deck && Array.isArray(deck)) {
              const filtered = deck.filter((c: any) => c.id < 68000000).slice(0, 8).map((c: any, index: number) => {
                let forcedForm: 'hero' | 'evo' | 'normal' = 'normal';
                
                if (index < 3) {
                  if (isHeroVariantUnlocked(c)) forcedForm = 'hero';
                  else if (isEvoUnlocked(c)) forcedForm = 'evo';
                }

                return { ...c, _forceForm: forcedForm };
              });
              const tower = deck.find((c: any) => c.id >= 68000000);
              return filtered.length === 8 ? { deck: filtered, towerTroopId: tower?.id, rating: proRating, playerName: proName, wins: 0, totalMatches: 0 } : null;
            }
          } catch { return null; }
          return null;
        }));
        decksWithRatings.push(...results.filter((d): d is any => d !== null));
        setMetaProgress(Math.round(((i + batch.length) / playersToFetch.length) * 100));
      }
      
      const deckCounts: Record<string, { cards: Card[], towerTroopId?: number, count: number, maxRating: number, bestPlayerName: string, wins: number, totalMatches: number }> = {};
      decksWithRatings.forEach(item => {
        const key = item.deck.map((c: any) => `${c.id}-${c._forceForm}`).sort().join(',');
        const itemRating = Number(item.rating);

        if (deckCounts[key]) {
          deckCounts[key].count++;
          deckCounts[key].wins += item.wins || 0;
          deckCounts[key].totalMatches += item.totalMatches || 0;
          if (itemRating > deckCounts[key].maxRating) {
            deckCounts[key].maxRating = itemRating;
            deckCounts[key].bestPlayerName = item.playerName;
          }
          if (!deckCounts[key].towerTroopId) deckCounts[key].towerTroopId = item.towerTroopId;
        } else {
          deckCounts[key] = { cards: item.deck, towerTroopId: item.towerTroopId, count: 1, maxRating: itemRating, bestPlayerName: item.playerName, wins: item.wins || 0, totalMatches: item.totalMatches || 0 };
        }
      });

      setRawDeckCounts(deckCounts);
    } catch (err: any) { console.error('Meta analysis failed.', err); } finally { setIsMetaLoading(false); }
  }, [profile, INTEGRATED_API_KEY]);

  useEffect(() => {
    if (!rawDeckCounts || !profile) return;
    
    const scoredDecks = Object.values(rawDeckCounts).map((meta: any) => {
      let totalLevel = 0;
      let maxLevelCount = 0;
      let ownedCount = 0;
      let levelScoreBoost = 0;
      
      let localCommonWild = isMaxPotentialMode ? (Number(magicItems.commonWild) || 0) : 0;
      let localRareWild = isMaxPotentialMode ? (Number(magicItems.rareWild) || 0) : 0;
      let localEpicWild = isMaxPotentialMode ? (Number(magicItems.epicWild) || 0) : 0;
      let localLegendaryWild = isMaxPotentialMode ? (Number(magicItems.legendaryWild) || 0) : 0;
      let localChampionWild = isMaxPotentialMode ? (Number(magicItems.championWild) || 0) : 0;
      let localEvoShards = isMaxPotentialMode ? (Number(magicItems.evoShards) || 0) : 0;
      let localHeroCoins = isMaxPotentialMode ? (Number(magicItems.heroCoins) || 0) : 0;
      let localGems = isMaxPotentialMode ? (Number(magicItems.gems) || 0) : 0;
      
      const missingEvos: { name: string; icon: string }[] = [];
      const missingHeroes: { name: string; icon: string }[] = [];
      const virtualUpgrades: { id: number; gold: number; level: number }[] = [];
      const evoShardsUsed: { id: number; count: number }[] = [];
      const heroCoinsUsed: { id: number; count: number }[] = [];
      let gemsUsed = 0;
      const gemsUsedByCard: { id: number; count: number }[] = [];
      const wildcardsUsed = { common: 0, rare: 0, epic: 0, legendary: 0, champion: 0 };
      const wildcardsUsedByCard: { id: number; count: number; rarity: string }[] = [];
      const missingBaseCards: string[] = [];
      const nonMaxLevelCards: string[] = [];
      const missingVariantNames: string[] = [];
        
      meta.cards.forEach((metaCard: any) => {
        const userCard = profile.cards.find((c: any) => Number(c.id) === Number(metaCard.id));
        const forcedForm = (metaCard as any)._forceForm;
        const metaIsEvo = forcedForm === 'evo';
        const metaIsHero = forcedForm === 'hero';
        const rarity = getRarityClass(metaCard);
        
        if (userCard) {
          ownedCount++;
          const displayLevel = Number(getDisplayLevel(userCard));
          
          if (displayLevel >= 16) {
            maxLevelCount++;
            totalLevel += displayLevel;
          } else {
            let currentWildCards = 0;
            if (rarity === 'common') currentWildCards = localCommonWild;
            else if (rarity === 'rare') currentWildCards = localRareWild;
            else if (rarity === 'epic') currentWildCards = localEpicWild;
            else if (rarity === 'legendary') currentWildCards = localLegendaryWild;
            else if (rarity === 'champion') currentWildCards = localChampionWild;

            const { virtualLevel, totalGold, remainingCount, remainingWildCards, remainingGems } = getVirtualLevelAndGold(rarity, displayLevel, userCard.count, currentWildCards, localGems);
            
            const usedWCs = currentWildCards - remainingWildCards;
            if (usedWCs > 0) {
              wildcardsUsedByCard.push({ id: metaCard.id, count: usedWCs, rarity });
            }
            
            const usedGems = localGems - remainingGems;
            if (usedGems > 0) {
              gemsUsed += usedGems;
              gemsUsedByCard.push({ id: metaCard.id, count: usedGems });
              localGems = remainingGems;
            }

            if (rarity === 'common') { wildcardsUsed.common += usedWCs; localCommonWild = remainingWildCards; }
            else if (rarity === 'rare') { wildcardsUsed.rare += usedWCs; localRareWild = remainingWildCards; }
            else if (rarity === 'epic') { wildcardsUsed.epic += usedWCs; localEpicWild = remainingWildCards; }
            else if (rarity === 'legendary') { wildcardsUsed.legendary += usedWCs; localLegendaryWild = remainingWildCards; }
            else if (rarity === 'champion') { wildcardsUsed.champion += usedWCs; localChampionWild = remainingWildCards; }

            if (virtualLevel > displayLevel) {
              virtualUpgrades.push({ id: metaCard.id, gold: totalGold, level: virtualLevel });
            }
            
            totalLevel += virtualLevel;
            if (virtualLevel >= 16) maxLevelCount++;
            else nonMaxLevelCards.push(metaCard.name);
            
            const requiredCards = getCardsToNextLevel(rarity, virtualLevel);
            if (requiredCards > 0) {
               const progress = Math.min(1, remainingCount / requiredCards);
               levelScoreBoost += (progress / 128) * 100;
            }
          }
          
          if (metaIsEvo && !isEvoUnlocked(userCard)) {
            let shardsNeeded = 6;
            if (magicItems.specificEvoShards && magicItems.specificEvoShards[metaCard.name]) {
              shardsNeeded -= magicItems.specificEvoShards[metaCard.name];
            }
            if (localEvoShards >= shardsNeeded) {
              localEvoShards -= shardsNeeded;
              evoShardsUsed.push({ id: metaCard.id, count: shardsNeeded });
            } else {
              missingEvos.push({ name: metaCard.name, icon: getCardIcon(metaCard, false, true) });
              missingVariantNames.push(metaCard.name + ' (Evo)');
            }
          }
          if (metaIsHero && !isHeroVariantUnlocked(userCard)) {
            if (localHeroCoins >= 200) {
              localHeroCoins -= 200;
              heroCoinsUsed.push({ id: metaCard.id, count: 200 });
            } else {
              missingHeroes.push({ name: metaCard.name, icon: getCardIcon(metaCard, true, false) });
              missingVariantNames.push(metaCard.name);
            }
          }
        } else { 
          totalLevel += 1; 
          missingBaseCards.push(metaCard.name);
          nonMaxLevelCards.push(metaCard.name);
          
          if (metaIsEvo) {
            let shardsNeeded = 6;
            if (magicItems.specificEvoShards && magicItems.specificEvoShards[metaCard.name]) {
              shardsNeeded -= magicItems.specificEvoShards[metaCard.name];
            }
            if (localEvoShards >= shardsNeeded) {
              localEvoShards -= shardsNeeded;
              evoShardsUsed.push({ id: metaCard.id, count: shardsNeeded });
            } else {
              missingEvos.push({ name: metaCard.name, icon: getCardIcon(metaCard, false, true) });
              missingVariantNames.push(metaCard.name + ' (Evo)');
            }
          }
          if (metaIsHero) {
            if (localHeroCoins >= 200) {
              localHeroCoins -= 200;
              heroCoinsUsed.push({ id: metaCard.id, count: 200 });
            } else {
              missingHeroes.push({ name: metaCard.name, icon: getCardIcon(metaCard, true, false) });
              missingVariantNames.push(metaCard.name);
            }
          }
        }
      });

      const levelScore = (totalLevel / 128) * 100 + levelScoreBoost;
      const missingCardPenalty = (8 - ownedCount) * 10;
      const missingVariantPenalty = (missingEvos.length + missingHeroes.length) * 5;
      const missingMaxLevelPenalty = (8 - maxLevelCount) * 2;
      
      let affinityRaw = levelScore - missingCardPenalty - missingVariantPenalty - missingMaxLevelPenalty;
      affinityRaw = Math.max(0, Math.min(100, affinityRaw));
      
      const tieBreaker = (Math.min(meta.count, 999) * 0.001) + (meta.maxRating * 0.0000001);
      const score = affinityRaw + tieBreaker;
      const avgElixir = getDeckAverageElixir(meta.cards);
      
      const totalVirtualGold = virtualUpgrades.reduce((sum: number, u: any) => sum + u.gold, 0);
      const totalEvoShardsUsed = evoShardsUsed.reduce((sum: number, e: any) => sum + e.count, 0);
      const totalCostScore = (gemsUsed * 1000) + 
                             (totalEvoShardsUsed * 5000) + 
                             (totalVirtualGold * 0.001) + 
                             (wildcardsUsed.common * 1) + 
                             (wildcardsUsed.rare * 5) + 
                             (wildcardsUsed.epic * 20) + 
                             (wildcardsUsed.legendary * 100) + 
                             (wildcardsUsed.champion * 200);

      const winRate = meta.totalMatches > 0 ? (meta.wins / meta.totalMatches) * 100 : 0;

      return {
        name: `Meta Archetype`,
        cards: meta.cards,
        towerTroopId: meta.towerTroopId,
        count: meta.count,
        maxedCount: maxLevelCount,
        isBestSynergy: ownedCount === 8 && missingEvos.length === 0 && missingHeroes.length === 0,
        maxMedals: meta.maxRating,
        bestPlayerName: meta.bestPlayerName,
        score,
        avgLevel: totalLevel / 8,
        elixirCost: avgElixir,
        missingEvos,
        missingHeroes,
        virtualUpgrades,
        evoShardsUsed,
        heroCoinsUsed,
        gemsUsed,
        gemsUsedByCard,
        totalCostScore,
        wildcardsUsed,
        wildcardsUsedByCard,
        winRate,
        totalMatches: meta.totalMatches,
        scoreBreakdown: {
          baseLevelScore: (totalLevel / 128) * 100,
          levelScoreBoost,
          missingCardPenalty,
          missingVariantPenalty,
          missingMaxLevelPenalty,
          missingBaseCards,
          missingVariants: missingVariantNames,
          nonMaxLevelCards
        }
      };
    });

    setMetaDecksCache(scoredDecks.sort((a, b) => {
      const aDisplayScore = Math.round(a.score);
      const bDisplayScore = Math.round(b.score);
      
      if (aDisplayScore !== bDisplayScore) return b.score - a.score;
      
      const aWinRate = a.winRate || 0;
      const bWinRate = b.winRate || 0;
      if (aWinRate !== bWinRate) return bWinRate - aWinRate;
      
      const aCost = a.totalCostScore || 0;
      const bCost = b.totalCostScore || 0;
      if (aCost !== bCost) return aCost - bCost;
      
      return (b.maxMedals || 0) - (a.maxMedals || 0);
    }));
  }, [rawDeckCounts, profile, magicItems, isMaxPotentialMode, getDisplayLevel, getRarityClass]);

  const metaInsightsData = useMemo(() => {
    if (!metaDecksCache || !profile) return null;
    
    const allMetaDecks = metaDecksCache;
    const totalDecksCount = allMetaDecks.length;
    const absoluteEvoUsage: Record<number, { name: string, icon: string, count: number }> = {};
    const absoluteHeroUsage: Record<number, { name: string, icon: string, count: number }> = {};
    const absoluteRarityUsage: Record<string, Record<number, { name: string, icon: string, count: number, rarity: string }>> = { common: {}, rare: {}, epic: {}, legendary: {}, champion: {} };

    allMetaDecks.forEach(deck => {
      deck.cards.forEach((metaCard: any, idx: number) => {
        const forcedForm = (metaCard as any)._forceForm;
        const cardRarity = getRarityClass(metaCard);
        if (absoluteRarityUsage[cardRarity]) {
          if (!absoluteRarityUsage[cardRarity][metaCard.id]) absoluteRarityUsage[cardRarity][metaCard.id] = { name: metaCard.name, icon: metaCard.iconUrls.medium, count: 0, rarity: cardRarity };
          absoluteRarityUsage[cardRarity][metaCard.id].count++;
        }
        if (idx < 3) {
          if (forcedForm === 'evo') {
            if (!absoluteEvoUsage[metaCard.id]) absoluteEvoUsage[metaCard.id] = { name: metaCard.name, icon: getCardIcon(metaCard, false, true), count: 0 };
            absoluteEvoUsage[metaCard.id].count++;
          } else if (forcedForm === 'hero') {
            if (!absoluteHeroUsage[metaCard.id]) absoluteHeroUsage[metaCard.id] = { name: metaCard.name, icon: getCardIcon(metaCard, true, false), count: 0 };
            absoluteHeroUsage[metaCard.id].count++;
          }
        }
      });
    });

    const missingEvoImpact: Record<number, { name: string, icon: string, impact: number, shardsNeeded: number }> = {};
    const missingHeroImpact: Record<number, { name: string, icon: string, impact: number, count: number }> = {};
    const upgradeRarityImpact: Record<number, { name: string, icon: string, impact: number, count: number, rarity: string, id: number, cardsNeeded: number, currentLevel: number }> = {};

    // Initialize with all non-maxed user cards so even non-meta cards appear in the upgrade list (at the bottom)
    profile.cards.forEach(userCard => {
      const displayLevel = getDisplayLevel(userCard);
      if (displayLevel > 0 && displayLevel < 16) {
        const r = getRarityClass(userCard);
        let totalNeeded = 0;
        for (let L = displayLevel; L < 16; L++) {
          totalNeeded += getCardsToNextLevel(r, L);
        }
        const owned = userCard.count || 0;
        const cardsNeeded = Math.max(0, totalNeeded - owned);
        upgradeRarityImpact[userCard.id] = {
          id: userCard.id, name: userCard.name, icon: userCard.iconUrls?.medium || getCardIcon(userCard, false, false),
          impact: 0, count: 0, rarity: r, cardsNeeded, currentLevel: displayLevel
        };
      }
    });

    allMetaDecks.forEach(deck => {
      const weight = Math.pow(deck.score / 10, 3);
      deck.cards.forEach((metaCard: any) => {
        const userCard = profile!.cards.find(c => Number(c.id) === Number(metaCard.id));
        const forcedForm = (metaCard as any)._forceForm;

        // Evo Logic
        if (forcedForm === 'evo' && (!userCard || !isEvoUnlocked(userCard))) {
          const shardsOwned = magicItems.specificEvoShards?.[metaCard.name] || 0;
          if (!missingEvoImpact[metaCard.id]) {
            missingEvoImpact[metaCard.id] = {
              name: metaCard.name,
              icon: getCardIcon(metaCard, false, true),
              impact: 0,
              shardsNeeded: Math.max(1, 6 - shardsOwned)
            };
          }
          const shardMultiplier = 1 + (shardsOwned * 0.3);
          missingEvoImpact[metaCard.id].impact += (weight * shardMultiplier);
        }

        // Hero Logic
        if (forcedForm === 'hero' && (!userCard || !isHeroVariantUnlocked(userCard))) {
          if (!missingHeroImpact[metaCard.id]) missingHeroImpact[metaCard.id] = { name: metaCard.name, icon: getCardIcon(metaCard, true, false), impact: 0, count: 0 };
          missingHeroImpact[metaCard.id].impact += weight;
          missingHeroImpact[metaCard.id].count++;
        }

        const displayLevel = userCard ? getDisplayLevel(userCard) : 0;
        if (displayLevel > 0 && displayLevel < 16) {
          const r = getRarityClass(metaCard);
          
          let totalNeeded = 0;
          for (let L = displayLevel; L < 16; L++) {
            totalNeeded += getCardsToNextLevel(r, L);
          }
          
          const owned = userCard?.count || 0;
          const cardsNeeded = Math.max(0, totalNeeded - owned);
          const progressRatio = totalNeeded > 0 ? Math.min(1, owned / totalNeeded) : 0;

          const levelGain = (16 - displayLevel) / 1.28 + 2;
          const progressMultiplier = 1 + (progressRatio * 1.5); // up to +150% if enough cards
          const finalGain = levelGain * progressMultiplier;

          if (!upgradeRarityImpact[metaCard.id]) {
            upgradeRarityImpact[metaCard.id] = { 
              id: metaCard.id, name: metaCard.name, icon: metaCard.iconUrls.medium, 
              impact: 0, count: 0, rarity: r, cardsNeeded, currentLevel: displayLevel 
            };
          }
          upgradeRarityImpact[metaCard.id].impact += (finalGain * weight);
          upgradeRarityImpact[metaCard.id].count++;
        }
      });
    });

    const evosList = Object.values(missingEvoImpact);
    const budget = Math.max(6, Number(magicItems.evoShards) || 0);

    const getCombinations = (list: any[], currentBudget: number): any[] => {
      const results: any[] = [];
      const generate = (index: number, currentCombo: any[], currentCost: number, currentImpact: number) => {
        if (currentCombo.length > 0) {
          results.push({
            items: [...currentCombo],
            totalImpact: currentImpact,
            totalCost: currentCost
          });
        }
        for (let i = index; i < list.length; i++) {
          const item = list[i];
          if (currentCost + item.shardsNeeded <= currentBudget) {
            currentCombo.push(item);
            generate(i + 1, currentCombo, currentCost + item.shardsNeeded, currentImpact + item.impact);
            currentCombo.pop();
          }
        }
      };
      generate(0, [], 0, 0);
      return results;
    };

    const allCombos = getCombinations(evosList, budget);
    const actualShards = Number(magicItems.evoShards) || 0;
    
    allCombos.sort((a, b) => {
      const aFeasible = a.totalCost <= actualShards;
      const bFeasible = b.totalCost <= actualShards;
      
      if (aFeasible && !bFeasible) return -1;
      if (!aFeasible && bFeasible) return 1;
      return b.totalImpact - a.totalImpact;
    });
    
    const sortedEvoCombos = allCombos.slice(0, 20);

    const sortedHeroes = Object.values(missingHeroImpact).sort((a, b) => b.impact - a.impact);
    const rarities = ['common', 'rare', 'epic', 'legendary', 'champion'];
    const rarityRecs = rarities.map(r => {
      const list = Object.values(upgradeRarityImpact).filter(c => c.rarity === r);
      let availableWilds = 0;
      if (r === 'common') availableWilds = Number(magicItems.commonWild) || 0;
      if (r === 'rare') availableWilds = Number(magicItems.rareWild) || 0;
      if (r === 'epic') availableWilds = Number(magicItems.epicWild) || 0;
      if (r === 'legendary') availableWilds = Number(magicItems.legendaryWild) || 0;
      if (r === 'champion') availableWilds = Number(magicItems.championWild) || 0;

      list.sort((a, b) => {
        const aFeasible = a.cardsNeeded <= availableWilds;
        const bFeasible = b.cardsNeeded <= availableWilds;
        
        if (aFeasible && !bFeasible) return -1;
        if (!aFeasible && bFeasible) return 1;
        return b.impact - a.impact;
      });

      return { rarity: r, list, availableWilds };
    });

    return {
      totalDecksCount,
      absoluteEvoUsage,
      absoluteHeroUsage,
      absoluteRarityUsage,
      sortedEvoCombos,
      sortedHeroes,
      rarityRecs,
      rarities
    };
  }, [
    metaDecksCache, profile, getDisplayLevel, getRarityClass, 
    magicItems.specificEvoShards, magicItems.evoShards, 
    magicItems.commonWild, magicItems.rareWild, magicItems.epicWild, magicItems.legendaryWild, magicItems.championWild
  ]);

  return {
    metaDecksCache,
    setMetaDecksCache,
    isMetaLoading,
    metaProgress,
    rawDeckCounts,
    setRawDeckCounts,
    performMetaAnalysis,
    metaInsightsData
  };
};
