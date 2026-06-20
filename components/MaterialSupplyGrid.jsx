import MaterialFlipCard from './MaterialFlipCard';
import { materialCards } from './materialCardData';

export default function MaterialSupplyGrid() {
  return (
    <div className="material-flip-grid" data-material-card-count={materialCards.length}>
      {materialCards.map((card) => (
        <MaterialFlipCard key={card.slug} {...card} />
      ))}
    </div>
  );
}