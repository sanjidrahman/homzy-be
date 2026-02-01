const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { sendOTPEmail } = require("../utils/emailService");
const { generateOTP } = require("../utils/generateOTP");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");

// Baker Signup - Step 1 (Send OTP)
const bakerSignupStep1 = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user already exists with this email
    const existingUser = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      // User already exists
      const user = existingUser.rows[0];

      // Check if baker profile exists
      const bakerProfile = await db.query(
        "SELECT * FROM baker_profiles WHERE user_id = $1",
        [user.id]
      );

      if (bakerProfile.rows.length > 0) {
        // Profile already completed
        return res.status(400).json({
          error: "You are already registered. Please login.",
        });
      } else {
        // User exists but profile not completed
        // Generate and send JWT token for profile completion
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return res.status(200).json({
          message: "Please complete your profile",
          requires: "profile_completion",
          token: token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      }
    }

    // No existing user - proceed with OTP flow
    // Check if there's already a pending OTP for this email
    const existingOTP = await db.query(
      "SELECT * FROM otp_verifications WHERE email = $1 AND is_used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email]
    );

    let otp;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (existingOTP.rows.length > 0) {
      // Resend existing OTP
      otp = existingOTP.rows[0].otp;
      console.log(`Resending existing OTP ${otp} to email ${email}`);
    } else {
      // Generate new OTP
      otp = generateOTP();
      const otpId = uuidv4();

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      // Store OTP with user details
      await db.query(
        "INSERT INTO otp_verifications (id, email, otp, expires_at, name, password, phone, is_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [otpId, email, otp, expiresAt, name, hashedPassword, phone, false]
      );

      console.log(`Generated new OTP ${otp} for email ${email}`);
    }

    // Send OTP email
    await sendOTPEmail(email, otp);

    return res.status(200).json({
      message: "OTP sent to your email",
      requires: "otp_verification",
    });
  } catch (error) {
    console.error("Baker signup step 1 error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Verify Email OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate required fields
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    // Get OTP record
    const result = await db.query(
      "SELECT * FROM otp_verifications WHERE email = $1 AND otp = $2 AND is_used = false ORDER BY created_at DESC LIMIT 1",
      [email, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    const otpRecord = result.rows[0];

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }

    // Check if user already exists (shouldn't happen, but safety check)
    const existingUser = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    let userId;
    let user;

    if (existingUser.rows.length > 0) {
      // User already exists (edge case)
      userId = existingUser.rows[0].id;
      user = existingUser.rows[0];
    } else {
      // Create new user (is_verified = FALSE until admin approves)
      userId = uuidv4();

      await db.query(
        "INSERT INTO users (id, name, email, password, phone, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          userId,
          otpRecord.name,
          email,
          otpRecord.password,
          otpRecord.phone,
          "baker",
          false,
        ]
      );

      // Get newly created user
      const newUserResult = await db.query(
        "SELECT id, name, email, phone, role, is_verified FROM users WHERE id = $1",
        [userId]
      );
      user = newUserResult.rows[0];
    }

    // Mark OTP as used
    await db.query(
      "UPDATE otp_verifications SET is_used = true, user_id = $1 WHERE id = $2",
      [userId, otpRecord.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.status(200).json({
      message: "Email verified successfully. Please complete your profile.",
      requires: "profile_completion",
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Complete Baker Profile - Step 2
const completeBakerProfile = async (req, res) => {
  try {
    // Check if baker profile already exists
    const existingProfile = await db.query(
      "SELECT * FROM baker_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (existingProfile.rows.length > 0) {
      return res.status(400).json({
        error: "Profile already submitted. Waiting for admin approval.",
      });
    }

    const {
      bakery_name,
      city,
      state,
      pincode,
      id_proof_type,
      id_proof_number,
      fssai_number,
      food_safety_declaration,
      payment_method,
      upi_id,
      bank_account_number,
      bank_ifsc,
      account_holder_name,
      item_types,
      is_veg,
      is_nonveg,
      has_eggless_option,
      terms_accepted,
    } = req.body;

    // Validate required fields
    if (
      !bakery_name ||
      !city ||
      !state ||
      !pincode ||
      !id_proof_type ||
      !id_proof_number ||
      !payment_method ||
      !terms_accepted
    ) {
      return res.status(400).json({ error: "Please fill all required fields" });
    }

    const files = req.files;

    // Upload profile photo
    let profilePhotoUrl = null;
    if (files && files.profile_photo && files.profile_photo[0]) {
      profilePhotoUrl = await uploadToCloudinary(
        files.profile_photo[0].path,
        "baker-app/profiles"
      );
    }

    // Upload ID proof
    let idProofUrl = null;
    if (files && files.id_proof_document && files.id_proof_document[0]) {
      idProofUrl = await uploadToCloudinary(
        files.id_proof_document[0].path,
        "baker-app/id-proofs"
      );
    }

    // Upload FSSAI certificate
    let fssaiCertificateUrl = null;
    if (files && files.fssai_certificate && files.fssai_certificate[0]) {
      fssaiCertificateUrl = await uploadToCloudinary(
        files.fssai_certificate[0].path,
        "baker-app/fssai-certificates"
      );
    }

    // Validate item_types
    let parsedItemTypes;
    try {
      parsedItemTypes =
        typeof item_types === "string" ? JSON.parse(item_types) : item_types;
    } catch (e) {
      return res.status(400).json({ error: "Invalid item_types format" });
    }

    // Generate UUID for baker profile
    const profileId = uuidv4();

    // Insert baker profile
    await db.query(
      `INSERT INTO baker_profiles (
        id, user_id, bakery_name, city, state, pincode,
        id_proof_type, id_proof_number, id_proof_document,
        profile_photo, fssai_number, fssai_certificate, food_safety_declaration,
        payment_method, upi_id, bank_account_number, bank_ifsc,
        account_holder_name, item_types, is_veg, is_nonveg,
        has_eggless_option, terms_accepted, terms_accepted_at, verification_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), $24)`,
      [
        profileId,
        req.user.id,
        bakery_name,
        city,
        state,
        pincode,
        id_proof_type,
        id_proof_number,
        idProofUrl,
        profilePhotoUrl,
        fssai_number || null,
        fssaiCertificateUrl,
        food_safety_declaration === "true" || food_safety_declaration === true,
        payment_method,
        payment_method === "upi" ? upi_id : null,
        payment_method === "bank" ? bank_account_number : null,
        payment_method === "bank" ? bank_ifsc : null,
        payment_method === "bank" ? account_holder_name : null,
        parsedItemTypes,
        is_veg === "true" || is_veg === true,
        is_nonveg === "true" || is_nonveg === true,
        has_eggless_option === "true" || has_eggless_option === true,
        terms_accepted === "true" || terms_accepted === true,
        "pending",
      ]
    );

    res.status(201).json({
      message:
        "Baker profile submitted successfully. Waiting for admin approval.",
      profile_id: profileId,
    });
  } catch (error) {
    console.error("Complete baker profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Check Verification Status
const getVerificationStatus = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT verification_status, rejection_reason, verified_at FROM baker_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Baker profile not found",
        requires: "profile_completion",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get verification status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Baker Profile
const getBakerProfile = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.*, bp.*
        FROM users u
        INNER JOIN baker_profiles bp ON u.id = bp.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Baker profile not found",
        requires: "profile_completion",
      });
    }

    res.json({ baker: result.rows[0] });
  } catch (error) {
    console.error("Get baker profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create Product
const createProduct = async (req, res) => {
  try {
    // Check if baker is verified
    const bakerProfile = await db.query(
      "SELECT verification_status FROM baker_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (bakerProfile.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Please complete your baker profile first" });
    }

    if (bakerProfile.rows[0].verification_status !== "approved") {
      return res.status(403).json({
        error:
          "Your profile is not approved yet. Please wait for admin approval.",
        verification_status: bakerProfile.rows[0].verification_status,
      });
    }

    const { name, description, price, category_id } = req.body;

    // Validate required fields
    if (!name || !price || !category_id) {
      return res
        .status(400)
        .json({ error: "Name, price, and category are required" });
    }

    // Upload product images (max 5)
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      // Limit to 5 images
      const filesToUpload = req.files.slice(0, 5);

      for (const file of filesToUpload) {
        const url = await uploadToCloudinary(file.path, "baker-app/products");
        imageUrls.push(url);
      }
    }

    // Generate UUID for product
    const productId = uuidv4();

    // Insert product
    await db.query(
      "INSERT INTO products (id, baker_id, name, description, price, category_id, image_urls, is_available) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        productId,
        req.user.id,
        name,
        description,
        price,
        category_id,
        imageUrls,
        true,
      ]
    );

    // Get created product
    const result = await db.query("SELECT * FROM products WHERE id = $1", [
      productId,
    ]);

    res.status(201).json({
      message: "Product created successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Baker's Products
const getBakerProducts = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.baker_id = $1 
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    res.json({ products: result.rows });
  } catch (error) {
    console.error("Get baker products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Product
const updateProduct = async (req, res) => {
  try {
    const { name, description, price, category_id, is_available } = req.body;
    const { id } = req.params;

    // Check if product belongs to baker
    const productCheck = await db.query(
      "SELECT * FROM products WHERE id = $1 AND baker_id = $2",
      [id, req.user.id]
    );

    if (productCheck.rows.length === 0) {
      return res
        .status(404)
        .json({
          error: "Product not found or you do not have permission to update it",
        });
    }

    // Handle image uploads (max 5)
    let imageUrls = productCheck.rows[0].image_urls || [];

    if (req.files && req.files.length > 0) {
      // If uploading new images, replace existing ones
      const filesToUpload = req.files.slice(0, 5);

      imageUrls = [];
      for (const file of filesToUpload) {
        const url = await uploadToCloudinary(file.path, "baker-app/products");
        imageUrls.push(url);
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name);
      paramCount++;
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(description);
      paramCount++;
    }
    if (price !== undefined) {
      updateFields.push(`price = $${paramCount}`);
      updateValues.push(price);
      paramCount++;
    }
    if (category_id !== undefined) {
      updateFields.push(`category_id = $${paramCount}`);
      updateValues.push(category_id);
      paramCount++;
    }
    if (req.files && req.files.length > 0) {
      updateFields.push(`image_urls = $${paramCount}`);
      updateValues.push(imageUrls);
      paramCount++;
    }
    if (is_available !== undefined) {
      updateFields.push(`is_available = $${paramCount}`);
      updateValues.push(is_available === "true" || is_available === true);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Add product ID as last parameter
    updateValues.push(id);

    // Update product
    await db.query(
      `UPDATE products SET ${updateFields.join(
        ", "
      )} WHERE id = $${paramCount}`,
      updateValues
    );

    // Get updated product
    const result = await db.query("SELECT * FROM products WHERE id = $1", [id]);

    res.json({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete Product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product belongs to baker
    const productCheck = await db.query(
      "SELECT * FROM products WHERE id = $1 AND baker_id = $2",
      [id, req.user.id]
    );

    if (productCheck.rows.length === 0) {
      return res
        .status(404)
        .json({
          error: "Product not found or you do not have permission to delete it",
        });
    }

    // Delete product
    await db.query("DELETE FROM products WHERE id = $1", [id]);

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Orders for Baker's Products
const getBakerOrders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       INNER JOIN users u ON o.user_id = u.id
       WHERE oi.baker_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      result.rows.map(async (order) => {
        const items = await db.query(
          `SELECT oi.*, p.name as product_name, p.image_urls as product_image
           FROM order_items oi
           INNER JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1 AND oi.baker_id = $2`,
          [order.id, req.user.id]
        );
        return { ...order, items: items.rows };
      })
    );

    res.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Get baker orders error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Valid statuses
    const validStatuses = [
      "accepted",
      "preparing",
      "ready",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Check if order contains baker's products
    const orderCheck = await db.query(
      `SELECT DISTINCT o.id 
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1 AND oi.baker_id = $2`,
      [id, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res
        .status(404)
        .json({
          error: "Order not found or you do not have permission to update it",
        });
    }

    // Update order status
    await db.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);

    res.json({ message: "Order status updated successfully" });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Baker Dashboard Stats
const getBakerDashboard = async (req, res) => {
  try {
    // Check if baker profile exists and is approved
    const bakerProfile = await db.query(
      "SELECT verification_status FROM baker_profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (bakerProfile.rows.length === 0) {
      return res.status(404).json({
        error: "Baker profile not found",
        requires: "profile_completion",
      });
    }

    // Get total products
    const productsResult = await db.query(
      "SELECT COUNT(*) as count FROM products WHERE baker_id = $1",
      [req.user.id]
    );

    // Get total orders
    const ordersResult = await db.query(
      `SELECT COUNT(DISTINCT o.id) as count
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.baker_id = $1`,
      [req.user.id]
    );

    // Get pending orders
    const pendingResult = await db.query(
      `SELECT COUNT(DISTINCT o.id) as count
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.baker_id = $1 AND o.status = 'pending'`,
      [req.user.id]
    );

    // Get total revenue
    const revenueResult = await db.query(
      `SELECT COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.baker_id = $1 AND o.status = 'completed'`,
      [req.user.id]
    );

    // Get recent orders
    const recentOrdersResult = await db.query(
      `SELECT DISTINCT o.*, u.name as user_name
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       INNER JOIN users u ON o.user_id = u.id
       WHERE oi.baker_id = $1
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [req.user.id]
    );

    // SALES DATA FOR CHARTS
    // Weekly sales (last 7 days)
    const weeklySalesResult = await db.query(
      `SELECT
         EXTRACT(DOW FROM o.created_at) as day_of_week,
         DATE_TRUNC('day', o.created_at) as date,
         SUM(oi.price * oi.quantity) as sales
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.baker_id = $1
         AND o.created_at >= NOW() - INTERVAL '7 days'
         AND o.payment_status = 'completed'
       GROUP BY date, day_of_week
       ORDER BY date`,
      [req.user.id]
    );

    // Format weekly sales
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklySales = weekDays.map(day => {
      const dayIndex = weekDays.indexOf(day);
      const found = weeklySalesResult.rows.find(r => parseInt(r.day_of_week) === dayIndex);
      return { period: day, sales: found ? parseFloat(found.sales) : 0 };
    });

    // Monthly sales (current year)
    const monthlySalesResult = await db.query(
      `SELECT
         EXTRACT(MONTH FROM o.created_at) as month,
         SUM(oi.price * oi.quantity) as sales
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.baker_id = $1
         AND EXTRACT(YEAR FROM o.created_at) = EXTRACT(YEAR FROM NOW())
         AND o.payment_status = 'completed'
       GROUP BY month
       ORDER BY month`,
      [req.user.id]
    );

    // Format monthly sales
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySales = months.map((month, index) => {
      const found = monthlySalesResult.rows.find(r => parseInt(r.month) === index + 1);
      return { period: month, sales: found ? parseFloat(found.sales) : 0 };
    });

    // Yearly sales (last 5 years)
    const yearlySalesResult = await db.query(
      `SELECT
         EXTRACT(YEAR FROM o.created_at) as year,
         SUM(oi.price * oi.quantity) as sales
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.baker_id = $1
         AND o.created_at >= NOW() - INTERVAL '5 years'
         AND o.payment_status = 'completed'
       GROUP BY year
       ORDER BY year`,
      [req.user.id]
    );

    // Format yearly sales
    const currentYear = new Date().getFullYear();
    const yearlySales = [];
    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;
      const found = yearlySalesResult.rows.find(r => parseInt(r.year) === year);
      yearlySales.push({ period: year.toString(), sales: found ? parseFloat(found.sales) : 0 });
    }

    res.json({
      verification_status: bakerProfile.rows[0].verification_status,
      total_products: parseInt(productsResult.rows[0].count),
      total_orders: parseInt(ordersResult.rows[0].count),
      pending_orders: parseInt(pendingResult.rows[0].count),
      total_revenue: parseFloat(revenueResult.rows[0].revenue),
      recent_orders: recentOrdersResult.rows,
      sales_data: {
        weekly: weeklySales,
        monthly: monthlySales,
        yearly: yearlySales
      }
    });
  } catch (error) {
    console.error("Get baker dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete Image (Unified Endpoint)
const deleteImage = async (req, res) => {
  try {
    const { type, entity_id, image_url } = req.body;

    // Validate required fields
    if (!type || !entity_id || !image_url) {
      return res.status(400).json({
        error: "Type, entity_id, and image_url are required"
      });
    }

    // Valid types
    const validTypes = ["product_image", "profile_photo", "id_proof"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: "Invalid type. Must be: product_image, profile_photo, or id_proof"
      });
    }

    // Handle different types
    if (type === "product_image") {
      // Check if product belongs to baker
      const productCheck = await db.query(
        "SELECT * FROM products WHERE id = $1 AND baker_id = $2",
        [entity_id, req.user.id]
      );

      if (productCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found or you do not have permission to update it"
        });
      }

      const currentImages = productCheck.rows[0].image_urls || [];

      // Check if image exists
      if (!currentImages.includes(image_url)) {
        return res.status(404).json({
          error: "Image not found in product"
        });
      }

      // Check minimum 1 image requirement
      if (currentImages.length <= 1) {
        return res.status(400).json({
          error: "Cannot delete the last image. Product must have at least 1 image."
        });
      }

      // Remove image from array
      const updatedImages = currentImages.filter(img => img !== image_url);

      // Update database
      await db.query(
        "UPDATE products SET image_urls = $1 WHERE id = $2",
        [updatedImages, entity_id]
      );

      res.json({
        message: "Product image deleted successfully",
        remaining_images: updatedImages.length
      });

    } else if (type === "profile_photo") {
      // Check if profile belongs to baker
      const profileCheck = await db.query(
        "SELECT * FROM baker_profiles WHERE user_id = $1",
        [req.user.id]
      );

      if (profileCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Baker profile not found"
        });
      }

      // Check if image_url matches current profile_photo
      if (profileCheck.rows[0].profile_photo !== image_url) {
        return res.status(400).json({
          error: "Image URL does not match current profile photo"
        });
      }

      // Set profile_photo to NULL
      await db.query(
        "UPDATE baker_profiles SET profile_photo = NULL WHERE user_id = $1",
        [req.user.id]
      );

      res.json({
        message: "Profile photo deleted successfully"
      });

    } else if (type === "id_proof") {
      // Check if profile belongs to baker
      const profileCheck = await db.query(
        "SELECT * FROM baker_profiles WHERE user_id = $1",
        [req.user.id]
      );

      if (profileCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Baker profile not found"
        });
      }

      // Check if image_url matches current id_proof_document
      if (profileCheck.rows[0].id_proof_document !== image_url) {
        return res.status(400).json({
          error: "Image URL does not match current ID proof document"
        });
      }

      // Set id_proof_document to NULL
      await db.query(
        "UPDATE baker_profiles SET id_proof_document = NULL WHERE user_id = $1",
        [req.user.id]
      );

      res.json({
        message: "ID proof document deleted successfully"
      });
    }

  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  bakerSignupStep1,
  verifyOTP,
  completeBakerProfile,
  getVerificationStatus,
  getBakerProfile,
  createProduct,
  getBakerProducts,
  updateProduct,
  deleteProduct,
  getBakerOrders,
  updateOrderStatus,
  getBakerDashboard,
  deleteImage,
};
