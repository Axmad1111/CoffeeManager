
const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Главная панель: статистика
app.get('/api/dashboard', async (req, res) => {
    try {
        const revenue = await db.query(`
            SELECT COALESCE(SUM(total), 0) AS total
            FROM orders
        `);

        const orderCount = await db.query(`
            SELECT COUNT(*) AS total
            FROM orders
        `);

        const popularProduct = await db.query(`
            SELECT product_name, SUM(quantity) AS quantity
            FROM order_items
            GROUP BY product_name
            ORDER BY quantity DESC
            LIMIT 1
        `);

        const count = Number(orderCount.rows[0].total);
        const total = Number(revenue.rows[0].total);

        res.json({
            revenue: total,
            orderCount: count,
            averageCheck: count > 0 ? total / count : 0,
            popularProduct: popularProduct.rows[0] || null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка загрузки статистики' });
    }
});

// Аналитика продаж
app.get('/api/analytics', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                COALESCE(SUM(total) FILTER (
                    WHERE created_at::date = CURRENT_DATE
                ), 0) AS today,

                COALESCE(SUM(total) FILTER (
                    WHERE created_at::date >= date_trunc('week', CURRENT_DATE)::date
                    AND created_at::date <= CURRENT_DATE
                ), 0) AS week,

                COALESCE(SUM(total) FILTER (
                    WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date
                    AND created_at::date <= CURRENT_DATE
                ), 0) AS month
            FROM orders
        `);

        const soldProducts = await db.query(`
            SELECT COALESCE(SUM(quantity), 0) AS total
            FROM order_items
        `);

        const dailyRevenue = await db.query(`
            SELECT
                created_at::date AS day,
                SUM(total) AS revenue
            FROM orders
            WHERE created_at::date >= CURRENT_DATE - INTERVAL '6 days'
            AND created_at::date <= CURRENT_DATE
            GROUP BY created_at::date
            ORDER BY day
        `);

        res.json({
            today: Number(result.rows[0].today),
            week: Number(result.rows[0].week),
            month: Number(result.rows[0].month),
            soldProducts: Number(soldProducts.rows[0].total),
            dailyRevenue: dailyRevenue.rows.map(row => ({
                day: row.day.toISOString
                    ? row.day.toISOString().slice(0, 10)
                    : String(row.day).slice(0, 10),
                revenue: Number(row.revenue)
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка загрузки аналитики' });
    }
});

// Получить все товары
app.get('/api/products', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM products ORDER BY id'
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
    }
});

// Добавить товар
app.post('/api/products', async (req, res) => {
    const { name, category, price } = req.body;

    if (
        typeof name !== 'string' || !name.trim() ||
        typeof category !== 'string' || !category.trim() ||
        !Number.isFinite(price) || price <= 0
    ) {
        return res.status(400).json({
            error: 'Проверьте название, категорию и цену'
        });
    }

    try {
        const result = await db.query(`
            INSERT INTO products (name, category, price)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [name.trim(), category.trim(), price]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка добавления товара' });
    }
});

// Редактировать товар
app.put('/api/products/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { name, category, price } = req.body;

    if (
        !Number.isInteger(id) || id <= 0 ||
        typeof name !== 'string' || !name.trim() ||
        typeof category !== 'string' || !category.trim() ||
        !Number.isFinite(price) || price <= 0
    ) {
        return res.status(400).json({
            error: 'Проверьте название, категорию и цену'
        });
    }

    try {
        const result = await db.query(`
            UPDATE products
            SET name = $1, category = $2, price = $3
            WHERE id = $4
            RETURNING *
        `, [name.trim(), category.trim(), price, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка изменения товара' });
    }
});

// Удалить товар
app.delete('/api/products/:id', async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    try {
        const result = await db.query(
            'DELETE FROM products WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        res.json({ message: 'Товар удалён' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка удаления товара' });
    }
});

// Получить историю заказов
app.get('/api/orders', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM orders
            ORDER BY id DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка загрузки заказов' });
    }
});

// Получить конкретный заказ с товарами
app.get('/api/orders/:id', async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Некорректный номер заказа'
        });
    }

    try {
        const order = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [id]
        );

        if (order.rowCount === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        const items = await db.query(`
            SELECT product_name, quantity, price
            FROM order_items
            WHERE order_id = $1
        `, [id]);

        res.json({
            ...order.rows[0],
            items: items.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка загрузки заказа' });
    }
});

// Оформить новый заказ
app.post('/api/orders', async (req, res) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            error: 'Добавьте товары в заказ'
        });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        let total = 0;
        const orderItems = [];

        for (const item of items) {
            const productId = Number(item.productId);
            const quantity = Number(item.quantity);

            if (
                !Number.isInteger(productId) || productId <= 0 ||
                !Number.isInteger(quantity) || quantity <= 0
            ) {
                throw new Error('Некорректные данные товара');
            }

            const product = await client.query(
                'SELECT * FROM products WHERE id = $1',
                [productId]
            );

            if (product.rowCount === 0) {
                throw new Error('Один из товаров не найден');
            }

            const currentProduct = product.rows[0];
            const price = Number(currentProduct.price);

            total += price * quantity;

            orderItems.push({
                productId,
                name: currentProduct.name,
                price,
                quantity
            });
        }

        const order = await client.query(`
            INSERT INTO orders (total)
            VALUES ($1)
            RETURNING id
        `, [total]);

        const orderId = order.rows[0].id;

        for (const item of orderItems) {
            await client.query(`
                INSERT INTO order_items
                (order_id, product_id, product_name, quantity, price)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                orderId,
                item.productId,
                item.name,
                item.quantity,
                item.price
            ]);
        }

        await client.query('COMMIT');

        console.log('Оформлен заказ №', orderId);

        res.status(201).json({
            message: 'Заказ успешно оформлен',
            orderId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);

        res.status(400).json({
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`CoffeeManager запущен: http://localhost:${PORT}`);
});
