'use client';

import Image from 'next/image';
import { useId, useState } from 'react';

export default function MaterialFlipCard({
  index,
  title,
  frontImage,
  imageWidth,
  imageHeight,
  backDescription,
  bullets,
  ctaLabel,
  ctaHref,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const descriptionId = useId();
  const bulletsId = useId();
  const titleId = useId();

  const isPriorityImage = index < 2;

  const toggleCard = () => {
    setIsFlipped((current) => !current);
  };

  const handleCtaClick = (event) => {
    event.stopPropagation();
  };

  return (
    <article className={`material-flip-card${isFlipped ? ' is-flipped' : ''}`}>
      <div className="material-flip-scene">
        <div className="material-flip-inner">
          <div className="material-flip-face material-flip-front" aria-hidden={isFlipped} aria-labelledby={titleId}>
            <div className={`material-flip-image-shell${isImageLoaded ? ' is-loaded' : ''}`}>
              <Image
                className="material-flip-image"
                src={frontImage}
                alt={title}
                width={imageWidth}
                height={imageHeight}
                sizes="(min-width: 1200px) 20vw, (min-width: 700px) 50vw, 100vw"
                loading={isPriorityImage ? undefined : 'lazy'}
                priority={isPriorityImage}
                quality={82}
                onLoad={() => setIsImageLoaded(true)}
              />
            </div>

            <button
              type="button"
              className="material-flip-toggle material-flip-toggle-front"
              aria-label={`View details for ${title}`}
              aria-pressed={isFlipped}
              onClick={toggleCard}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 16V11" />
                <circle cx="12" cy="7.5" r="1" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span className="sr-only">{`View details for ${title}`}</span>
            </button>
          </div>

          <div
            className="material-flip-face material-flip-back"
            aria-hidden={!isFlipped}
            aria-describedby={`${descriptionId} ${bulletsId}`}
            aria-labelledby={titleId}
          >
            <div className="material-flip-copy">
              <div className="material-flip-topline">
                <p className="material-flip-eyebrow">What We Supply</p>
                <button
                  type="button"
                  className="material-flip-toggle material-flip-toggle-back"
                  aria-label={`Return to image for ${title}`}
                  aria-pressed={isFlipped}
                  onClick={toggleCard}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 15.5V19a1 1 0 0 0 1 1h3.5" />
                    <path d="M20 8.5V5a1 1 0 0 0-1-1h-3.5" />
                    <path d="M8.5 20a8 8 0 1 1 7-14.5" />
                    <path d="m16 4 1.5 1.5L16 7" />
                  </svg>
                  <span className="sr-only">{`Return to image for ${title}`}</span>
                </button>
              </div>

              <h3 id={titleId} className="material-flip-title">{title}</h3>
              <p id={descriptionId} className="material-flip-description">
                {backDescription}
              </p>
              <ul id={bulletsId} className="material-flip-bullets">
                {bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>

            <a className="material-flip-cta" href={ctaHref} onClick={handleCtaClick}>
              {ctaLabel}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}