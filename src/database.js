
const { Pool } = require('pg');
require('dotenv').config({
    path: require('path').join(__dirname, '../.env')
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (error) => {
    console.error('Ошибка PostgreSQL:', error.message);
});

console.log('Подключение к PostgreSQL настроено!');

module.exports = pool;
