import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import slugify from 'slugify';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a product image to Cloudinary
 */
export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // req.files already contains path (Cloudinary URL) and filename (public_id)
    const uploadedImages = req.files.map(file => ({
      url: file.path,       // Cloudinary URL
      public_id: file.filename, // Cloudinary public_id
    }));

    res.json(uploadedImages);
  } catch (err) {
    console.error("Error uploading images:", err);
    res.status(500).json({ message: "Error uploading images", error: err.message });
  }
};

/**
 * Delete a product image from Cloudinary
 */
const deleteImageFile = async (public_id) => {
  try {
    if (public_id) await cloudinary.uploader.destroy(public_id);
  } catch (err) {
    console.error("Error deleting image:", err);
  }
};

// Admin: Create product


export const create = async (req, res) => {
  try {
    const body = {
      title: req.body.title?.trim(),
      description: req.body.description,
      category: req.body.category,
      brand: req.body.brand,
      price: req.body.price != null ? Number(req.body.price) : undefined,
      stock: req.body.stock != null ? Number(req.body.stock) : undefined,
      active:
        typeof req.body.active === 'string'
          ? req.body.active === 'true'
          : Boolean(req.body.active),
    };

    if (!body.title) return res.status(400).json({ error: 'title is required' });
    if (!Number.isFinite(body.price)) return res.status(400).json({ error: 'price must be a number' });

    // Generate slug
    body.slug = slugify(body.title, { lower: true, strict: true });

    // Upload images in parallel
    let images = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      images = await Promise.all(
        req.files.map(async (file) => {
          try {
            const result = await cloudinary.uploader.upload(file.path, { folder: 'products' });
            try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch {}
            return { url: result.secure_url, public_id: result.public_id };
          } catch (err) {
            console.error('Cloudinary upload failed for file:', file.path, err);
            return null;
          }
        })
      );
      images = images.filter(Boolean);
    }

    const product = await Product.create({ ...body, images });
    return res.status(201).json(product);

  } catch (err) {
    console.error('Error creating product:', err);
    if (err.code === 11000 && err.keyPattern?.slug) {
      return res.status(400).json({ message: 'Product with this slug already exists' });
    }
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};




// Admin: Update product
export const update = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let images = product.images || [];

    // Handle new uploaded files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, { folder: "products" });
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        images.push({ url: result.secure_url, public_id: result.public_id });
      }
    }

    Object.assign(product, req.body, { images });
    await product.save();

    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Error updating product", error: err.message });
  }
};

// Admin: Remove product (soft delete + delete images)
export const remove = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    await Promise.all(product.images?.map((img) => deleteImageFile(img.public_id)));

    product.active = false;
    await product.save();

    res.json({ message: "Product deactivated and images deleted" });
  } catch (err) {
    res.status(400).json({ message: "Error deleting product", error: err.message });
  }
};

// Admin: Remove a single image from product
export const removeImage = async (req, res) => {
  try {
    const { productId, public_id } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.images = product.images.filter((img) => img.public_id !== public_id);
    await product.save();

    await deleteImageFile(public_id);

    res.json({ message: "Image removed", product });
  } catch (err) {
    res.status(400).json({ message: "Error removing image", error: err.message });
  }
};

// Product listing
export const list = async (req, res) => {
  try {
    const { q, category, min, max, lowStock } = req.query;
    const filter = { active: true };

    if (q) filter.title = { $regex: q, $options: "i" };
    if (category) filter.category = category;
    if (min || max) {
      filter.price = {
        ...(min ? { $gte: Number(min) } : {}),
        ...(max ? { $lte: Number(max) } : {}),
      };
    }
    if (lowStock === "true") {
      filter.$expr = { $lte: ["$stock", "$lowStockThreshold"] };
    }

    const products = await Product.find(filter).sort("-createdAt").lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
};

// Get single product
export const getOne = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.active) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Error fetching product", error: err.message });
  }
};

// Admin list
export const adminList = async (req, res) => {
  try {
    const products = await Product.find().sort("-createdAt").lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
};

// Update stock
export const updateStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Error updating stock", error: err.message });
  }
};

// Get stats (revenue, orders, products, monthly revenue, top products)
export const getStats = async (req, res) => {
  try {
    const revenueAgg = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" }, totalOrders: { $sum: 1 } } },
    ]);

    const revenue = revenueAgg[0]?.totalRevenue || 0;
    const ordersCount = revenueAgg[0]?.totalOrders || 0;
    const productsCount = await Product.countDocuments({ active: true });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const monthlyRevenueAgg = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, revenue: { $sum: "$total" } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyRevenue = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const found = monthlyRevenueAgg.find(
        (m) => m._id.year === d.getFullYear() && m._id.month === d.getMonth() + 1
      );
      monthlyRevenue.push({ month: d.toLocaleString("default", { month: "short" }), revenue: found?.revenue || 0 });
    }

    const ordersStatusAgg = await Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    const ordersStatus = {};
    ordersStatusAgg.forEach((o) => (ordersStatus[o._id] = o.count));

    const topProductsAgg = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { "items.product": { $ne: null } } },
      { $group: { _id: "$items.product", totalSold: { $sum: "$items.quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $project: { _id: 0, title: "$product.title", totalSold: 1 } },
    ]);

    res.json({ revenue, orders: ordersCount, products: productsCount, monthlyRevenue, ordersStatus, topProducts: topProductsAgg });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ message: "Error fetching stats", error: err.message });
  }
};

export const categories = async (req, res) => {
  try {
    const categories = await Product.distinct("category", { deletedAt: null });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

export const brands = async (req, res) => {
  try {
    const brands = await Product.distinct("brand", { deletedAt: null });
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch brands" });
  }
};