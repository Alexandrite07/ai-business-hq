export default function ProductLoading() {
  return (
    <section aria-label="Loading product" className="product-detail-section">
      <div className="product-detail-layout">
        <div className="product-gallery gallery-loading" />
        <div className="product-purchase">
          <span className="eyebrow">SUNDAY RITUALS</span>
          <div className="loading-line loading-line-long" />
          <div className="loading-line" />
          <div className="loading-line loading-line-short" />
        </div>
      </div>
    </section>
  );
}
