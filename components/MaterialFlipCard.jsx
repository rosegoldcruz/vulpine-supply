'use client';

import { useId, useState } from 'react';

export default function MaterialFlipCard({
  title,
  frontImage,
  backDescription,
  bullets,
  ctaLabel,
  ctaHref,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const descriptionId = useId();
  const bulletsId = useId();

  const toggleCard = () => {
    setIsFlipped((current) => !current);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleCard();
    }
  };

  const handleCtaClick = (event) => {
    event.stopPropagation();
  };

  return (
    <article className={`material-flip-card${isFlipped ? ' is-flipped' : ''}`}>
      <div className="material-flip-scene">
        <div className="material-flip-inner">
          <div className="material-flip-face material-flip-front" aria-hidden={isFlipped}>
            <img
              className="material-flip-image"
              src={frontImage}
              alt={title}
              loading="lazy"
              decoding="async"
            />

            <button
              type="button"
              className="material-flip-toggle material-flip-toggle-front"
              aria-label={`Show details for ${title}`}
              aria-pressed={isFlipped}
              onClick={toggleCard}
              onKeyDown={handleKeyDown}
            >
              <span className="sr-only">{`Show details for ${title}`}</span>
            </button>
          </div>

          <div
            className="material-flip-face material-flip-back"
            aria-hidden={!isFlipped}
            aria-describedby={`${descriptionId} ${bulletsId}`}
          >
            <div className="material-flip-copy">
              <div className="material-flip-topline">
                <p className="material-flip-eyebrow">What We Supply</p>
                <button
                  type="button"
                  className="material-flip-toggle material-flip-toggle-back"
                  aria-label={`Show image for ${title}`}
                  aria-pressed={isFlipped}
                  onClick={toggleCard}
                  onKeyDown={handleKeyDown}
                >
                  View image
                </button>
              </div>

              <h3 className="material-flip-title">{title}</h3>
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