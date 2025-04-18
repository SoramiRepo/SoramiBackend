import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    createdAt: { type: Date, default: Date.now }
});


export default mongoose.model('Post', postSchema);
