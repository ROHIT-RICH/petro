import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import slugify from "slugify";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ------------------ Image Helpers ------------------ */
export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedImages = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));

    res.json(uploadedImages);
  } catch (err) {
    console.error("Error uploading images:", err);
    res
      .status(500)
      .json({ message: "Error uploading images", error: err.message });
  }
};

const deleteImageFile = async (public_id) => {
  try {
    if (public_id) await cloudinary.uploader.destroy(public_id);
  } catch (err) {
    console.error("Error deleting image:", err);
  }
};

/* ------------------ Create Product ------------------ */
export const create = async (req, res) => {
  try {
    const title = req.body.title?.toString().trim();
    if (!title) return res.status(400).json({ error: "Title is required" });

    const description = req.body.description?.toString() || "";
    const category = req.body.category?.toString() || "";
    const brand = req.body.brand?.toString() || "";

    // Parse variants safely
    let variants = [];
    if (req.body.variants) {
      if (typeof req.body.variants === "string") {
        try {
          variants = JSON.parse(req.body.variants);
        } catch {
          variants = [];
        }
      } else if (Array.isArray(req.body.variants)) {
        variants = req.body.variants;
      }
    }

    // Fallback price (only if no variants)
    let price;
    if (variants.length === 0 && req.body.price != null) {
      price = Number(req.body.price);
      if (!Number.isFinite(price)) {
        return res
          .status(400)
          .json({ error: "Price must be a valid number if no variants" });
      }
    }

    // 🔥 Auto stock calculation
    const stock = variants.length
      ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
      : Number(req.body.stock) || 0;

    const active =
      typeof req.body.active === "string"
        ? req.body.active === "true"
        : Boolean(req.body.active);

    const slug = slugify(title, { lower: true, strict: true });

    // Upload images to Cloudinary
    let images = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      images = await Promise.all(
        req.files.map(async (file) => {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "products",
            });
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return { url: result.secure_url, public_id: result.public_id };
          } catch (err) {
            console.error("Cloudinary upload failed:", err);
            return null;
          }
        })
      );
      images = images.filter(Boolean);
    }

    const product = await Product.create({
      title,
      description,
      category,
      brand,
      price,
      variants,
      stock,
      active,
      slug,
      images,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Error creating product:", err);
    if (err.code === 11000 && err.keyPattern?.slug) {
      return res
        .status(400)
        .json({ message: "Product with this slug already exists" });
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

/* ------------------ Update Product ------------------ */
export const update = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Clone existing images
    let images = [...(product.images || [])];

    // Handle new uploaded files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "products",
        });
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        images.push({ url: result.secure_url, public_id: result.public_id });
      }
    }

    // Parse variants safely
    let variants = product.variants || [];
    if (req.body.variants) {
      if (typeof req.body.variants === "string") {
        try {
          variants = JSON.parse(req.body.variants);
        } catch {
          return res.status(400).json({ message: "Invalid variants format" });
        }
      } else if (Array.isArray(req.body.variants)) {
        variants = req.body.variants;
      }
    }

    // Recalculate stock
    const stock = variants.length
      ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
      : req.body.stock != null
      ? Number(req.body.stock)
      : product.stock;

    // Ensure stock is valid
    if (Number.isNaN(stock)) {
      return res.status(400).json({ message: "Stock must be a valid number" });
    }

    // Safely update allowed fields
    product.title = req.body.title ?? product.title;
    product.description = req.body.description ?? product.description;
    product.category = req.body.category ?? product.category;
    product.brand = req.body.brand ?? product.brand;
    product.price =
      req.body.price != null ? Number(req.body.price) : product.price;
    product.active =
      req.body.active != null
        ? req.body.active === "true" || req.body.active === true
        : product.active;
    product.images = images;
    product.variants = variants;
    product.stock = stock;

    // Update slug if title changed
    if (req.body.title) {
      product.slug = slugify(req.body.title, { lower: true, strict: true });
    }

    await product.save();
    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};


/* ------------------ Remove Product ------------------ */
export const remove = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    await Promise.all(
      product.images?.map((img) => deleteImageFile(img.public_id))
    );

    product.active = false;
    await product.save();

    res.json({ message: "Product deactivated and images deleted" });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Error deleting product", error: err.message });
  }
};

export const destroy = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    // Check if linked with any order
    const orderExists = await Order.exists({ "items.product": product._id });
    if (orderExists) {
      return res.status(400).json({
        message: "Product cannot be permanently deleted, it is linked to orders",
      });
    }

    // Delete all product images
    await Promise.all(
      (product.images || []).map((img) => deleteImageFile(img.public_id))
    );

    // Delete from DB
    await Product.findByIdAndDelete(product._id);

    res.json({ message: "Product permanently deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error permanently deleting product", error: err.message });
  }
};

/* ------------------ Remove Single Image ------------------ */
export const removeImage = async (req, res) => {
  try {
    const { productId, public_id } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.images = product.images.filter(
      (img) => img.public_id !== public_id
    );
    await product.save();

    await deleteImageFile(public_id);

    res.json({ message: "Image removed", product });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Error removing image", error: err.message });
  }
};

/* ------------------ Listing APIs ------------------ */
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
    res
      .status(500)
      .json({ message: "Error fetching products", error: err.message });
  }
};

export const getOne = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.active)
      return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching product", error: err.message });
  }
};

export const adminList = async (req, res) => {
  try {
    const products = await Product.find().sort("-createdAt").lean();
    res.json(products);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching products", error: err.message });
  }
};

/* ------------------ Stock ------------------ */
export const updateStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) {
    res
      .status(400)
      .json({ message: "Error updating stock", error: err.message });
  }
};

/* ------------------ Stats ------------------ */
export const getStats = async (req, res) => {
  try {
    // ✅ Include processing, shipped, delivered
    const revenueAgg = await Order.aggregate([
      { $match: { status: { $in: ["processing", "shipped", "delivered"] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const revenue = revenueAgg[0]?.totalRevenue || 0;
    const ordersCount = revenueAgg[0]?.totalOrders || 0;
    const productsCount = await Product.countDocuments({ active: true });

    // ✅ Monthly revenue (last 6 months, only processing/shipped/delivered)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const monthlyRevenueAgg = await Order.aggregate([
      {
        $match: {
          status: { $in: ["processing", "shipped", "delivered"] },
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$total" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyRevenue = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const found = monthlyRevenueAgg.find(
        (m) =>
          m._id.year === d.getFullYear() && m._id.month === d.getMonth() + 1
      );
      monthlyRevenue.push({
        month: d.toLocaleString("default", { month: "short" }),
        revenue: found?.revenue || 0,
      });
    }

    // Orders status distribution (still counts all statuses)
    const ordersStatusAgg = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const ordersStatus = {};
    ordersStatusAgg.forEach((o) => (ordersStatus[o._id] = o.count));

    // Top products (only from processing/shipped/delivered orders)
    const topProductsAgg = await Order.aggregate([
      { $match: { status: { $in: ["processing", "shipped", "delivered"] } } },
      { $unwind: "$items" },
      { $match: { "items.product": { $ne: null } } },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $project: { _id: 0, title: "$product.title", totalSold: 1 } },
    ]);

    res.json({
      revenue,
      orders: ordersCount,
      products: productsCount,
      monthlyRevenue,
      ordersStatus,
      topProducts: topProductsAgg,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res
      .status(500)
      .json({ message: "Error fetching stats", error: err.message });
  }
};


/* ------------------ Categories & Brands ------------------ */
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
