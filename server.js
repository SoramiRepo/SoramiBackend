import express from 'express';
import cors from 'cors';
import connectDB from './utils/db.js';
import userRoutes from './routes/user.js';
import postRoutes from './routes/post.js';

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/user', userRoutes);
app.use('/api/post', postRoutes);

app.use((req, res, next) => {
    console.log("Fallback 404 route hit:", req.path);
    res.status(404).json({ message: "Route not found" });
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
