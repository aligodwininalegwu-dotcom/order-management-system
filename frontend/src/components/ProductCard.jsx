import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatNaira, stockLabel } from '../utils/format';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = product.imageUrl && !imageFailed;
  const stock = stockLabel(product.stockQuantity);

  const handleAddToCart = () => {
    addToCart(product);
    showToast(`${product.name} added to cart`);
  };

  return (
    <article className="product-card">
      <Link
        to={`/products/${product._id}`}
        className="product-card-image"
        aria-label={`View ${product.name}`}
        tabIndex={-1}
      >
        {showImage ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="product-card-image-fallback" aria-hidden="true">
            {product.name.charAt(0)}
          </span>
        )}
        <span className="product-category-tag">{product.category}</span>
      </Link>

      <div className="product-card-body">
        <Link to={`/products/${product._id}`} className="product-card-title-link">
          <h3>{product.name}</h3>
        </Link>
        <p className="product-description">{product.description}</p>

        <div className="product-card-footer">
          <span className="product-price">{formatNaira(product.price)}</span>
          <span className={`product-stock ${stock.tone}-stock`}>{stock.text}</span>
        </div>

        <button disabled={product.stockQuantity === 0} onClick={handleAddToCart}>
          {product.stockQuantity === 0 ? 'Sold out' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}
