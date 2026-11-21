"use client";

import { useState } from "react";

export function ProductGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [selectedImage, setSelectedImage] = useState(0);
  const galleryImages = images.length ? images : [""];

  return (
    <div className="product-gallery">
      <div
        aria-label={`${title}, image ${selectedImage + 1} of ${galleryImages.length}`}
        className="gallery-main-image"
        role="img"
        style={{
          backgroundImage: galleryImages[selectedImage]
            ? `url("${galleryImages[selectedImage]}")`
            : undefined,
        }}
      >
        <span className="gallery-image-note">Your softer-morning ritual</span>
      </div>
      <div aria-label="Product images" className="gallery-thumbnails">
        {galleryImages.map((image, index) => (
          <button
            aria-label={`View product image ${index + 1}`}
            aria-pressed={selectedImage === index}
            className={`gallery-thumbnail ${selectedImage === index ? "is-selected" : ""}`}
            key={`${image}-${index}`}
            onClick={() => setSelectedImage(index)}
            style={{ backgroundImage: image ? `url("${image}")` : undefined }}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
