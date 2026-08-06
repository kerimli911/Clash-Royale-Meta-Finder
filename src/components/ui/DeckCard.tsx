import React from 'react';
import { CardImage } from '../CardImage';
import { Copy, QrCode, TrendingUp, UserCircle2, CheckCircle2, AlertCircle, Droplets, Trophy, Gem, Activity, Medal, Check, Target } from 'lucide-react';
import { isEvoUnlocked, isHeroVariantUnlocked, getCardIcon, isChampion } from '../../types/clashRoyale';
import type { MetaDeck } from '../../App';
import type { PlayerProfile } from '../../types/clashRoyale';

interface DeckCardProps {
  deck: MetaDeck;
  idx: number;
  profile: PlayerProfile;
  expandedScoreIdx: number | null;
  setExpandedScoreIdx: (idx: number | null) => void;
  handleCopyDeck: (deck: MetaDeck, idx: number) => void;
  handleShowQr: (deck: MetaDeck) => void;
  getDisplayLevel: (card: any) => number;
  getCardSubstitutesData: (cardName: string) => { name: string, icon: string } | null;
  copiedIndex: number | null;
  
}

const DeckCardComponent: React.FC<DeckCardProps> = ({
  deck,
  idx,
  profile,
  expandedScoreIdx,
  setExpandedScoreIdx,
  handleCopyDeck,
  handleShowQr,
  getDisplayLevel,
  getCardSubstitutesData,
  copiedIndex,
  }) => {

            const missingCards: any[] = [];
            const ownedLevelSum = deck.cards.reduce((sum: number, metaCard: any) => {
              const uCard = profile.cards.find((c: any) => Number(c.id) === Number(metaCard.id));
              if (!uCard) missingCards.push(metaCard);
              return sum + (uCard ? getDisplayLevel(uCard) : 0);
            }, 0);
            const ownedCount = 8 - missingCards.length;
            const realAvgLevel = ownedCount > 0 ? (ownedLevelSum / ownedCount).toFixed(1) : 0;
            const affinityPercent = Math.floor(deck.score);
            const affinityColor = affinityPercent >= 95 ? '#4ade80' : (affinityPercent >= 70 ? '#fbbf24' : '#ef4444');

            const evoCount = deck.cards.filter((c: any) => c._forceForm === 'evo').length;
            const champCount = deck.cards.filter((c: any) => isChampion(c) || c._forceForm === 'hero').length;
            let themeClass = '';
            if (evoCount > champCount && evoCount > 0) themeClass = 'theme-evo';
            else if (champCount > evoCount && champCount > 0) themeClass = 'theme-champion';
            else if (evoCount > 0 && champCount > 0) themeClass = 'theme-mixed';

            const totalVirtualGold = deck.virtualUpgrades?.reduce((sum: number, u: any) => sum + u.gold, 0) || 0;
            const totalEvoShardsUsed = deck.evoShardsUsed?.reduce((sum: number, e: any) => sum + e.count, 0) || 0;
            const totalHeroCoinsUsed = deck.heroCoinsUsed?.reduce((sum: number, h: any) => sum + h.count, 0) || 0;
            const wcu = deck.wildcardsUsed || {};

            // STABLE KEY FOR PERFORMANCE
            const deckKey = deck.cards.map((c: any) => `${c.id}-${(c as any)._forceForm}`).sort().join('|') + `-${deck.towerTroopId}`;

            return (
              <div key={deckKey} className={`deck-suggestion ${themeClass}`}>
                <div className="deck-header">
                  <div className="deck-header-left">
                    <div className="deck-header-info">
                      <div className="deck-meta-tags">
                        <div className="meta-tag uses" title="Number of Pro Players using this exact 8-card combination"><Trophy size={12} /> <span>{deck.count} PRO USES</span></div>
                        {deck.maxMedals > 0 && <div className="meta-tag medals" title="Highest medals achieved with this deck"><Medal size={12} /> <span>{deck.maxMedals}</span></div>}
                        {deck.bestPlayerName && <div className="meta-tag player" title="Top player using this deck"><UserCircle2 size={12} /> <span>{deck.bestPlayerName}</span></div>}
                        {deck.winRate !== undefined && (
                          <div className="meta-tag" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)' }} title="Win Rate"><TrendingUp size={12} /> <span>{deck.winRate.toFixed(1)}% WR</span></div>
                        )}
                        <div className="meta-tag" style={{ color: '#d946ef', borderColor: 'rgba(217, 70, 239, 0.3)', background: 'rgba(217, 70, 239, 0.1)' }} title="Avg Elixir"><Droplets size={12} /> <span>{deck.elixirCost.toFixed(1)}</span></div>
                      </div>
                    </div>
                    <div className="deck-actions">
                      <button 
                        className={`action-btn copy-btn ${copiedIndex === idx ? 'copied' : ''}`}
                        onClick={() => handleCopyDeck(deck, idx)}
                      >
                        {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedIndex === idx ? 'COPIED!' : 'COPY'}</span>
                      </button>
                      <button 
                        className="action-btn qr-btn"
                        onClick={() => handleShowQr(deck)}
                        title="Show QR Code"
                      >
                        <QrCode size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="deck-header-right" style={{ position: 'relative' }} 
                    onMouseEnter={() => setExpandedScoreIdx(idx)} 
                    onMouseLeave={() => setExpandedScoreIdx(null)}
                    onClick={() => setExpandedScoreIdx(expandedScoreIdx === idx ? null : idx)}
                  >
                    <div className="affinity-pill" style={{ borderColor: affinityColor, boxShadow: `0 0 10px ${affinityColor}33`, cursor: 'pointer' }}>
                      <Target size={14} style={{ color: affinityColor }} />
                      <div className="affinity-content">
                        <span className="label">AFFINITY</span>
                        <span className="value" style={{ color: affinityColor }}>{affinityPercent}%</span>
                      </div>
                    </div>
                    
                    {expandedScoreIdx === idx && deck.scoreBreakdown && (
                      <div className="score-breakdown-panel" style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        right: 0, 
                        zIndex: 100, 
                        width: 'max-content',
                        minWidth: '300px',
                        maxWidth: '90vw',
                        background: 'rgba(15,23,42,0.95)', 
                        backdropFilter: 'blur(16px)', 
                        marginTop: '0.5rem', 
                        padding: '1.25rem', 
                        borderRadius: '1rem', 
                        border: '1px solid rgba(255,255,255,0.15)', 
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                        animation: 'fadeIn 0.2s ease-out' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><Activity size={16} /> SCORE BREAKDOWN</span>
                          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>{deck.score.toFixed(2)}%</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80' }}>
                            <span>📈 Base Level Score</span>
                            <span>+{deck.scoreBreakdown.baseLevelScore.toFixed(2)}%</span>
                          </div>
                          
                          {deck.scoreBreakdown.levelScoreBoost > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#60a5fa' }}>
                              <span>⚡ Progress Boost</span>
                              <span>+{deck.scoreBreakdown.levelScoreBoost.toFixed(2)}%</span>
                            </div>
                          )}
                          
                          {deck.scoreBreakdown.missingCardPenalty > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                                <span>🚫 Missing Cards Penalty (-10% each)</span>
                                <span>-{deck.scoreBreakdown.missingCardPenalty.toFixed(2)}%</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {deck.scoreBreakdown.missingBaseCards.map((c: any) => <span key={c} style={{ fontSize: '0.7rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '1rem', border: '1px solid rgba(239,68,68,0.3)' }}>{c}</span>)}
                              </div>
                            </div>
                          )}
                          
                          {deck.scoreBreakdown.missingVariantPenalty > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f97316' }}>
                                <span>💎 Missing Evo/Hero Penalty (-5% each)</span>
                                <span>-{deck.scoreBreakdown.missingVariantPenalty.toFixed(2)}%</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {deck.scoreBreakdown.missingVariants.map((c: any) => <span key={c} style={{ fontSize: '0.7rem', background: 'rgba(249,115,22,0.2)', color: '#f97316', padding: '0.2rem 0.5rem', borderRadius: '1rem', border: '1px solid rgba(249,115,22,0.3)' }}>{c}</span>)}
                              </div>
                            </div>
                          )}
                          
                          {deck.scoreBreakdown.missingMaxLevelPenalty > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#eab308' }}>
                                <span>👑 Non-Max Level Penalty (-2% each)</span>
                                <span>-{deck.scoreBreakdown.missingMaxLevelPenalty.toFixed(2)}%</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {deck.scoreBreakdown.nonMaxLevelCards.map((c: any) => <span key={c} style={{ fontSize: '0.7rem', background: 'rgba(234,179,8,0.2)', color: '#eab308', padding: '0.2rem 0.5rem', borderRadius: '1rem', border: '1px solid rgba(234,179,8,0.3)' }}>{c}</span>)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="deck-main-content">
                  <div className="mini-card-grid">
                    {deck.cards.map((card, index) => {
                      const userCard = profile.cards.find((c: any) => Number(c.id) === Number(card.id));
                      const userLevel = userCard ? getDisplayLevel(userCard) : 0;
                      const isMaxed = userLevel >= 16;
                      
                      // STRICT VARIANT DETECTION (Restricted to slots 0, 1, 2)
                      const forcedForm = (card as any)._forceForm;
                      const canHaveVariant = index < 3;
                      const cardIsHero = canHaveVariant && (forcedForm === 'hero' || isHeroVariantUnlocked(card));
                      const cardIsEvo = canHaveVariant && (forcedForm === 'evo' || (!cardIsHero && isEvoUnlocked(card)));
                      const cardIsChamp = isChampion(card);
                      
                      const displayIcon = getCardIcon(card, cardIsHero, cardIsEvo);
                      const cardRarity = (card.name && card.name.toLowerCase().includes('ronin')) ? 'legendary' : (card.rarity || 'common').toLowerCase();
                      const isRonin = card.name && card.name.toLowerCase().includes('ronin');

                      const virtualUpgradeInfo = deck.virtualUpgrades?.find((u: any) => u.id === card.id);
                      const evoUsed = deck.evoShardsUsed?.find((e: any) => e.id === card.id);
                      const heroUsed = deck.heroCoinsUsed?.find((h: any) => h.id === card.id);

                      return (
                        <div 
                          key={card.id || index} 
                          className={`mini-card ${cardIsEvo ? 'evo-slot' : ''} ${cardIsChamp ? 'champion-slot' : ''} ${cardIsHero ? 'hero-slot' : ''} ${cardRarity === 'legendary' ? 'card-legendary' : ''} ${isRonin ? 'card-ronin' : ''}`} 
                          style={{ 
                            opacity: userCard ? 1 : 0.4, 
                            '--card-img': `url(${displayIcon})` 
                          } as React.CSSProperties}
                        >
                          <div className="card-image-container">
                            {displayIcon && <CardImage src={displayIcon} cardName={card.name} />}
                          </div>
                          
                          <div className="card-badges-container">
                            {virtualUpgradeInfo && (
                              <div className="virtual-upgrade-badge" title={`Can upgrade to lvl ${virtualUpgradeInfo.level}`}>
                                <span className="coin-icon">💰</span>{virtualUpgradeInfo.gold >= 1000 ? `${Math.floor(virtualUpgradeInfo.gold / 1000)}k` : virtualUpgradeInfo.gold}
                              </div>
                            )}
                            
                            {evoUsed && (
                              <div className="magic-badge evo-badge" title={`${evoUsed.count} Evo Shards needed`}>
                                💎 {evoUsed.count}
                              </div>
                            )}
                            
                            {heroUsed && (
                              <div className="magic-badge hero-badge" title={`${heroUsed.count} Hero Coins needed`}>
                                🪙 {heroUsed.count}
                              </div>
                            )}

                            {(() => {
                              const gemInfo = deck.gemsUsedByCard?.find((g: any) => g.id === card.id);
                              if (!gemInfo) return null;
                              return (
                                <div className="magic-badge" style={{
                                  background: '#10b981',
                                  color: 'white',
                                  borderColor: 'rgba(255,255,255,0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }} title={`${gemInfo.count} Gems needed`}>
                                  <Gem size={10} fill="currentColor" /> {gemInfo.count}
                                </div>
                              );
                            })()}

                            {(() => {
                              const wcInfo = deck.wildcardsUsedByCard?.find((w: any) => w.id === card.id);
                              if (!wcInfo) return null;
                              return (
                                <div className="magic-badge" style={{
                                  background: `var(--rarity-${wcInfo.rarity})`,
                                  color: 'white',
                                  borderColor: 'rgba(255,255,255,0.3)'
                                }} title={`${wcInfo.count} ${wcInfo.rarity} Wildcards needed`}>
                                  🃏 {wcInfo.count}
                                </div>
                              );
                            })()}
                          </div>

                          <div className={`mini-level ${isMaxed ? 'maxed' : ''} ${virtualUpgradeInfo ? 'virtual' : ''}`}>
                            {virtualUpgradeInfo ? virtualUpgradeInfo.level : (userLevel || '!')}
                          </div>
                          {cardIsEvo && <div className="evo-indicator-tiny"></div>}
                          {cardIsChamp && <div className="champion-indicator-tiny"></div>}
                          {cardIsHero && <div className="hero-indicator-tiny"></div>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="deck-stats-group">
                    <div className="deck-stat-item">
                      <div className="stat-icon"><Droplets size={14} color="#d946ef" /></div>
                      <div className="stat-info"><span className="stat-label">AVG ELIXIR</span><span className="stat-value">{deck.elixirCost.toFixed(1)}</span></div>
                    </div>
                    <div className="deck-stat-item">
                      <div className="stat-icon"><Activity size={14} /></div>
                      <div className="stat-info"><span className="stat-label">AVG LEVEL</span><span className="stat-value">{realAvgLevel}</span></div>
                    </div>
                    <div className={`deck-stat-item ${deck.maxedCount === 8 ? 'maxed' : ''}`}>
                      <div className="stat-icon"><CheckCircle2 size={14} /></div>
                      <div className="stat-info"><span className="stat-label">MAXED CARDS</span><span className="stat-value">{deck.maxedCount}/8</span></div>
                    </div>
                  </div>
                </div>

                {(missingCards.length > 0 || deck.missingEvos?.length > 0 || deck.missingHeroes?.length > 0) ? (
                  <div className="deck-missing-section">
                    <div className="missing-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div className="missing-label"><AlertCircle size={12} /><span>MISSING REQUIREMENTS</span></div>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {totalVirtualGold > 0 && (
                          <div className="virtual-total-gold" title="Total Gold Needed">
                            <span className="coin-icon">💰</span> {totalVirtualGold >= 1000 ? `${Math.floor(totalVirtualGold / 1000)}k` : totalVirtualGold}
                          </div>
                        )}
                        {(deck.gemsUsed || 0) > 0 && (
                          <div className="virtual-total-gold" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', gap: '3px' }} title="Gems Used">
                            <Gem size={12} fill="currentColor" /> {deck.gemsUsed}
                          </div>
                        )}
                        {totalEvoShardsUsed > 0 && (
                          <div className="virtual-total-gold" style={{ color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.3)', background: 'rgba(167, 139, 250, 0.1)' }} title="Wild Evo Shards">
                            <span className="coin-icon">💎</span> {totalEvoShardsUsed}
                          </div>
                        )}
                        {totalHeroCoinsUsed > 0 && (
                          <div className="virtual-total-gold" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)', background: 'rgba(251, 191, 36, 0.1)' }} title="Hero Coins">
                            <span className="coin-icon">🪙</span> {totalHeroCoinsUsed}
                          </div>
                        )}
                        {wcu.common > 0 && <div className="virtual-total-gold" style={{ color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.3)' }} title="Common Wildcards"><span className="coin-icon">🃏</span> {wcu.common}</div>}
                        {wcu.rare > 0 && <div className="virtual-total-gold" style={{ color: '#fb923c', borderColor: 'rgba(251, 146, 60, 0.3)' }} title="Rare Wildcards"><span className="coin-icon">🃏</span> {wcu.rare}</div>}
                        {wcu.epic > 0 && <div className="virtual-total-gold" style={{ color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }} title="Epic Wildcards"><span className="coin-icon">🃏</span> {wcu.epic}</div>}
                        {wcu.legendary > 0 && <div className="virtual-total-gold" style={{ color: '#2dd4bf', borderColor: 'rgba(45, 212, 191, 0.3)' }} title="Legendary Wildcards"><span className="coin-icon">🃏</span> {wcu.legendary}</div>}
                        {wcu.champion > 0 && <div className="virtual-total-gold" style={{ color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.3)' }} title="Champion Wildcards"><span className="coin-icon">🃏</span> {wcu.champion}</div>}
                      </div>
                    </div>
                    <div className="missing-icons-list">
                      {deck.missingEvos?.map((evo, eIdx) => (
                        <div key={`evo-${eIdx}`} className="missing-item-badge evo">
                          <CardImage src={evo.icon} cardName={evo.name} />
                          <span>{evo.name} (EVO)</span>
                        </div>
                      ))}
                      {deck.missingHeroes?.map((hero, hIdx) => (
                        <div key={`hero-${hIdx}`} className="missing-item-badge hero">
                          <CardImage src={hero.icon} cardName={hero.name} />
                          <span>{hero.name}</span>
                        </div>
                      ))}
                      {missingCards.map((c: any, i: number) => {
                        const sub = getCardSubstitutesData(c.name);
                        return (
                          <div key={`card-${i}`} className="missing-item-badge">
                            <CardImage src={c.iconUrls.medium} cardName={c.name} />
                            <span>{c.name}</span>
                            {sub && (
                              <div style={{ marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>Try:</span>
                                <CardImage src={sub.icon} cardName={sub.name} style={{ width: '16px', height: '16px', borderRadius: '50%' }} title={`Substitute with ${sub.name}`} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="deck-ready-footer" style={{ justifyContent: totalVirtualGold > 0 ? 'space-between' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <CheckCircle2 size={12} /><span>DECK FULLY READY</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {totalVirtualGold > 0 && (
                        <div className="virtual-total-gold" title="Total Gold Needed">
                          <span className="coin-icon">💰</span> {totalVirtualGold >= 1000 ? `${Math.floor(totalVirtualGold / 1000)}k` : totalVirtualGold}
                        </div>
                      )}
                      {(deck.gemsUsed || 0) > 0 && (
                        <div className="virtual-total-gold" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', gap: '3px' }} title="Gems Used">
                          <Gem size={12} fill="currentColor" /> {deck.gemsUsed}
                        </div>
                      )}
                      {totalEvoShardsUsed > 0 && (
                        <div className="virtual-total-gold" style={{ color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.3)', background: 'rgba(167, 139, 250, 0.1)' }} title="Wild Evo Shards">
                          <span className="coin-icon">💎</span> {totalEvoShardsUsed}
                        </div>
                      )}
                      {totalHeroCoinsUsed > 0 && (
                        <div className="virtual-total-gold" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)', background: 'rgba(251, 191, 36, 0.1)' }} title="Hero Coins">
                          <span className="coin-icon">🪙</span> {totalHeroCoinsUsed}
                        </div>
                      )}
                      {wcu.common > 0 && <div className="virtual-total-gold" style={{ color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.3)' }} title="Common Wildcards"><span className="coin-icon">🃏</span> {wcu.common}</div>}
                      {wcu.rare > 0 && <div className="virtual-total-gold" style={{ color: '#fb923c', borderColor: 'rgba(251, 146, 60, 0.3)' }} title="Rare Wildcards"><span className="coin-icon">🃏</span> {wcu.rare}</div>}
                      {wcu.epic > 0 && <div className="virtual-total-gold" style={{ color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }} title="Epic Wildcards"><span className="coin-icon">🃏</span> {wcu.epic}</div>}
                      {wcu.legendary > 0 && <div className="virtual-total-gold" style={{ color: '#2dd4bf', borderColor: 'rgba(45, 212, 191, 0.3)' }} title="Legendary Wildcards"><span className="coin-icon">🃏</span> {wcu.legendary}</div>}
                      {wcu.champion > 0 && <div className="virtual-total-gold" style={{ color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.3)' }} title="Champion Wildcards"><span className="coin-icon">🃏</span> {wcu.champion}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          
};

export const DeckCard = React.memo(DeckCardComponent, (previous, next) => {
  const wasScoreExpanded = previous.expandedScoreIdx === previous.idx;
  const isScoreExpanded = next.expandedScoreIdx === next.idx;
  const wasCopied = previous.copiedIndex === previous.idx;
  const isCopied = next.copiedIndex === next.idx;

  return previous.deck === next.deck
    && previous.profile === next.profile
    && previous.idx === next.idx
    && wasScoreExpanded === isScoreExpanded
    && wasCopied === isCopied
    && previous.getDisplayLevel === next.getDisplayLevel
    && previous.getCardSubstitutesData === next.getCardSubstitutesData
    && previous.handleCopyDeck === next.handleCopyDeck
    && previous.handleShowQr === next.handleShowQr;
});
