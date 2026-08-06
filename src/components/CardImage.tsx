import React, { useState, useEffect, useRef } from 'react';
import { getCardSlug } from '../types/clashRoyale';

interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  cardName: string;
}

export const CardImage: React.FC<CardImageProps> = ({ cardName, src, className, alt, style, ...props }) => {
  const [isMissing, setIsMissing] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync state if parent changes src
  useEffect(() => {
    setCurrentSrc(src);
    setIsMissing(false);
    if (imgRef.current && imgRef.current.parentElement) {
      imgRef.current.parentElement.classList.remove('missing-image');
    }
  }, [src]);

  const handleError = () => {
    const slug = getCardSlug(cardName);
    const fallback = `https://cdn.royaleapi.com/static/img/cards-150/${slug}.png`;
    const unknownImg = 'https://cdn.royaleapi.com/static/img/cards-150/unknown.png';

    if (currentSrc !== fallback && !currentSrc?.includes('unknown.png')) {
      setCurrentSrc(fallback);
    } else if (!currentSrc?.includes('unknown.png')) {
      setCurrentSrc(unknownImg);
      setIsMissing(true);
      if (imgRef.current && imgRef.current.parentElement) {
        imgRef.current.parentElement.classList.add('missing-image');
        // Ensure parent is position relative for the overlay
        const parentPosition = window.getComputedStyle(imgRef.current.parentElement).position;
        if (parentPosition === 'static') {
          imgRef.current.parentElement.style.position = 'relative';
        }
      }
    }
  };

  return (
    <>
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt || cardName}
        loading="lazy"
        decoding="async"
        className={className}
        style={style}
        onError={handleError}
        {...props}
      />
      {isMissing && <div className="fallback-name-overlay">{cardName}</div>}
    </>
  );
};

