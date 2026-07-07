import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import redis from "../config/redis.js";
import jwt from "jsonwebtoken";

import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "../utils/token.js";

export const register = async (req, res) => {

    const { name, email, password } = req.body;

    try {
        if (!name || !email || !password) {
            throw new Error("All fields are required");
        }

        const userAlreadyExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (userAlreadyExists.rows.length > 0) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUserQuery = `
            INSERT INTO users (email, password_hash, display_name)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name as "displayName", bio, avatar_url as "avatarUrl"
        `;

        const result = await pool.query(
            newUserQuery,
            [email, hashedPassword, name]
        );

        const user = result.rows[0];

        // Generate token
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // Save refresh token to DB
        const expiry = getRefreshTokenExpiry(7);

        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [user.id, refreshToken, expiry]
        );

        return res.status(201).json({
            success: true,
            user,
            token: { accessToken, refreshToken }
        })

    } catch (error) {
        console.error("Error in register controller");
        res.status(400).json({ success: false, message: error.message });
    }

    console.log("Register route");
}

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const dbUser = result.rows[0];

        const isMatch = await bcrypt.compare(password, dbUser.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const accessToken = generateAccessToken(dbUser.id);
        const refreshToken = generateRefreshToken(dbUser.id);

        // Lưu Refresh Token mới vào PostgreSQL
        const expiry = getRefreshTokenExpiry(7);
        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [dbUser.id, refreshToken, expiry]
        );

        const user = {
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.display_name,
            bio: dbUser.bio,
            avatarUrl: dbUser.avatar_url
        }

        return res.status(200).json({
            success: true,
            user,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        console.error("Error in login controller: ", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const logout = async (req, res) => {
    try {

        const { id: userId, jti, exp } = req.user;

        const now = Math.floor(Date.now() / 1000);
        const remainingSeconds = exp - now;

        if (remainingSeconds > 0) {
            await redis.setex(`blacklist:${jti}`, remainingSeconds, "true");
        }

        // Delete refresh token of user in DB
        await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (error) {
        console.error("Error in logout controller: ", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const refresh = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            message: "Refresh token is required"
        });
    }

    try {

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const tokenResult = await pool.query(
            "SELECT * FROM refresh_tokens WHERE token = $1",
            [refreshToken]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        const dbToken = tokenResult.rows[0];

        if (dbToken.is_revoked || new Date(dbToken.expires_at) < new Date()) {
            await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [decoded.id]);
            return res.status(401).json({
                success: false,
                message: "Session expired or compromised"
            });
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(decoded.id);
        const newRefreshToken = generateRefreshToken(decoded.id);

        // Delete old token and insert new token
        await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);

        const expiry = getRefreshTokenExpiry(7);
        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [decoded.id, newRefreshToken, expiry]
        );

        return res.status(200).json({
            success: true,
            tokens: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            }
        });

    } catch (error) {
        console.error("Error in refresh token controller: ", error);
        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
}