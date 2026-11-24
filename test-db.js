
require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function testConnection() {
    try {
        const result = await pool.query(`
            SELECT
                current_database() AS database,
                current_user AS username
        `);

        console.log('Подключение к Supabase успешно!');
        console.log('База данных:', result.rows[0].database);
        console.log('Пользователь:', result.rows[0].username);

        const products = await pool.query(
            'SELECT id, name, price FROM products ORDER BY id'
        );

        console.log('Товары в облачной базе:');
        console.table(products.rows);

    } catch (error) {
        console.error('Ошибка подключения:', error.message);
    } finally {
        await pool.end();
    }
}

testConnection();
