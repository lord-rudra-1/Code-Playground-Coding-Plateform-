const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(
            `mongodb+srv://madaraxghost404:Bq5kpz28E0hWfGUE@codeplayground.po6vj.mongodb.net/?retryWrites=true&w=majority&appName=codeplayground`
        );

        console.log(`MongoDB Connected: {conn.connection.host}`);
    } catch (error) {
        // console.log("Couldn't connect to MongoDB")
        console.error(error.message);
        process.exit(1);
    }
};
module.exports = connectDB;