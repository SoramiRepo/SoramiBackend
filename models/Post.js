import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null }, // Reply
    createdAt: { type: Date, default: Date.now },
    repost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null }, // Repost
});


export default mongoose.model('Post', postSchema);
