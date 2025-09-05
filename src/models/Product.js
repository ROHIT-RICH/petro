import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true, index: true }, // SEO-friendly URLs
    description: String,
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
    price: { type: Number, required: true, min: 0 },
    category: { type: String, index: true },
    brand: { type: String, index: true },
    stock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    active: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
