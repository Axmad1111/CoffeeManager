
require('dotenv').config();

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

// Подключаем старую локальную базу SQLite
const sqlite = new Database(
    path.join(__dirname, 'src', 'coffeemanager.db')
);

// Подключаем облачную базу Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrateData() {
    const client = await pool.connect();

    try {
        console.log('Читаем данные из SQLite...');

        const products = sqlite.prepare(
            'SELECT * FROM products ORDER BY id'
        ).all();

        const orders = sqlite.prepare(
            'SELECT * FROM orders ORDER BY id'
        ).all();

        const orderItems = sqlite.prepare(
            'SELECT * FROM order_items ORDER BY id'
        ).all();

        console.log('Товаров:', products.length);
        console.log('Заказов:', orders.length);
        console.log('Позиций заказов:', orderItems.length);

        await client.query('BEGIN');

        // Переносим товары
        for (const item of products) {
            await client.query(`
                INSERT INTO products (id, name, category, price)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING
            `, [
                item.id,
                item.name,
                item.category,
                item.price
            ]);
        }

        // Переносим заказы
        for (const order of orders) {
            await client.query(`
                INSERT INTO orders (id, created_at, total)
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO NOTHING
            `, [
                order.id,
                order.created_at,
                order.total
            ]);
        }

        // Переносим состав заказов
        for (const item of orderItems) {
            await client.query(`
                INSERT INTO order_items
                (id, order_id, product_id, product_name, quantity, price)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
            `, [
                item.id,
                item.order_id,
                item.product_id,
                item.product_name,
                item.quantity,
                item.price
            ]);
        }

        // Обновляем последовательности ID
        for (const table of ['products', 'orders', 'order_items']) {
            await client.query(`
                SELECT setval(
                    pg_get_serial_sequence($1, 'id'),
                    COALESCE((SELECT MAX(id) FROM ${table}), 1),
                    EXISTS (SELECT 1 FROM ${table})
                )
            `, [table]);
        }

        await client.query('COMMIT');

        console.log('\nПеренос данных завершён успешно!');
        console.log('Товары:', products.length);
        console.log('Заказы:', orders.length);
        console.log('Позиции заказов:', orderItems.length);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка переноса:', error.message);
    } finally {
        client.release();
        await pool.end();
        sqlite.close();
    }
}

migrateData();
