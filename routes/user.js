import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Ensure that the username and password are valid
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password cannot be empty' });
        }

        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: 'Username does not exist' });

        // Ensure the password matches the one stored in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Password Incorrect' });

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login Successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                avatarname: user.avatarname,
                avatarimg: user.avatarimg,
                bio: user.bio,
                registertime: user.registertime,
            },
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Registration Endpoint
router.post('/register', async (req, res) => {
    const { username, password, avatarname, avatarimg, bio } = req.body;

    // Check if the user already exists
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = new User({
            username,
            password: hashedPassword,
            avatarname: avatarname || '',
            avatarimg: avatarimg || '',
            bio: bio || '',
            registertime: new Date(),
        });

        // Save the user to the database
        await newUser.save();

        // Generate JWT
        const token = jwt.sign(
            { userId: newUser._id, username: newUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registration Successful',
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                avatarname: newUser.avatarname,
                avatarimg: newUser.avatarimg,
                bio: newUser.bio,
                registertime: newUser.registertime,
            },
        });
    } catch (err) {
        console.error('Register Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get("/:username", async (req, res) => {
    try {
        const { username } = req.params;

        console.log("DEBUG -> " + username);

        const user = await User.findOne({ username });

        if (!user) {
            console.log("DEBUG -> Not found");
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            user: {
                _id: user._id,
                username: user.username,
                avatarname: user.avatarname,
                avatarimg: user.avatarimg,
                bio: user.bio,
                registertime: user.registertime
            }
        });
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ message: 'Server error' });
    }
})

export default router;
