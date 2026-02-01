const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");

// Create Category (TEMPORARY ENDPOINT - Remove after seeding data)
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Check if category already exists
    const existingCategory = await db.query(
      "SELECT * FROM categories WHERE name = $1",
      [name]
    );

    if (existingCategory.rows.length > 0) {
      return res.status(400).json({ error: "Category already exists" });
    }

    // Generate UUID for category
    const categoryId = uuidv4();

    // Insert category
    await db.query(
      "INSERT INTO categories (id, name) VALUES ($1, $2)",
      [categoryId, name]
    );

    // Get created category
    const result = await db.query("SELECT * FROM categories WHERE id = $1", [
      categoryId,
    ]);

    res.status(201).json({
      message: "Category created successfully",
      category: result.rows[0],
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get All Categories (PERMANENT ENDPOINT)
const getAllCategories = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, created_at FROM categories ORDER BY name ASC"
    );

    res.json({ categories: result.rows });
  } catch (error) {
    console.error("Get all categories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
};
