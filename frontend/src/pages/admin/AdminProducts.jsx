import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatNaira } from '../../utils/format';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  category: '',
  stockQuantity: '',
  sku: '',
  imageUrl: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null); // null = creating a new product
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products', { auth: false });
      setProducts(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const startEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      stockQuantity: product.stockQuantity,
      sku: product.sku || '',
      imageUrl: product.imageUrl || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      ...form,
      price: Number(form.price),
      stockQuantity: Number(form.stockQuantity),
    };

    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        await api.post('/products', payload);
      }
      cancelEdit();
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/products/${id}`);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-section">
      <div className="page-heading">
        <h1>Manage products</h1>
        <p>{products.length} in catalogue</p>
      </div>

      <form onSubmit={handleSubmit} className="admin-form">
        <h2>{editingId ? 'Edit product' : 'Add a new product'}</h2>
        <div className="admin-form-grid">
          <label>
            Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>
            Category
            <input name="category" value={form.category} onChange={handleChange} required />
          </label>
          <label>
            Price (₦)
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              min="0"
              required
            />
          </label>
          <label>
            Stock quantity
            <input
              type="number"
              name="stockQuantity"
              value={form.stockQuantity}
              onChange={handleChange}
              min="0"
              required
            />
          </label>
          <label>
            SKU (optional)
            <input name="sku" value={form.sku} onChange={handleChange} />
          </label>
          <label>
            Image URL (optional)
            <input name="imageUrl" type="url" value={form.imageUrl} onChange={handleChange} />
          </label>
        </div>
        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            required
          />
        </label>

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="admin-form-actions">
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update product' : 'Add product'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="page-heading">
        <h2>Existing products</h2>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 240 }} aria-hidden="true" />
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id}>
                  <td data-label="Name">
                    <strong>{product.name}</strong>
                  </td>
                  <td data-label="Category">{product.category}</td>
                  <td data-label="Price">{formatNaira(product.price)}</td>
                  <td data-label="Stock">{product.stockQuantity}</td>
                  <td data-label="Actions" className="admin-table-actions">
                    <button type="button" className="btn-link" onClick={() => startEdit(product)}>
                      Edit
                    </button>
                    <button type="button" className="btn-link" onClick={() => handleDelete(product._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
