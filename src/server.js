
const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Главная панель: статистика
app.get('/api/dashboard', (req, res) => {
    const revenue = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total
        FROM orders
    `).get();

    const orderCount = db.prepare(`
        SELECT COUNT(*) AS total
        FROM orders
    `).get();

    const popularProduct = db.prepare(`
        SELECT product_name, SUM(quantity) AS quantity
        FROM order_items
        GROUP BY product_name
        ORDER BY quantity DESC
        LIMIT 1
    `).get();

    const averageCheck = orderCount.total > 0
        ? revenue.total / orderCount.total
        : 0;

    res.json({
        revenue: revenue.total,
        orderCount: orderCount.total,
        averageCheck,
        popularProduct: popularProduct || null
    });
});

// Аналитика продаж
app.get('/api/analytics', (req, res) => {
    // Выручка за сегодня
    const today = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE date(created_at) = date('now', 'localtime')
    `).get();

    // Начало текущей недели (понедельник)
    const week = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE date(created_at) >= date(
            'now', 'localtime',
            '-' || ((strftime('%w', 'now', 'localtime') + 6) % 7) || ' days'
        )
        AND date(created_at) <= date('now', 'localtime')
    `).get();

    // Выручка за текущий месяц
    const month = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE date(created_at) >= date('now', 'localtime', 'start of month')
        AND date(created_at) <= date('now', 'localtime')
    `).get();

    // Общее количество проданных товаров
    const soldProducts = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM order_items
    `).get();

    // Выручка за последние семь календарных дней
    const dailyRevenue = db.prepare(`
        SELECT
            date(created_at) AS day,
            SUM(total) AS revenue
        FROM orders
        WHERE date(created_at) >= date('now', 'localtime', '-6 days')
        AND date(created_at) <= date('now', 'localtime')
        GROUP BY date(created_at)
        ORDER BY day
    `).all();

    res.json({
        today: today.revenue,
        week: week.revenue,
        month: month.revenue,
        soldProducts: soldProducts.total,
        dailyRevenue
    });
});

// Получить все товары
app.get('/api/products', (req, res) => {
    const products = db.prepare(
        'SELECT * FROM products ORDER BY id'
    ).all();

    res.json(products);
});

// Добавить товар
app.post('/api/products', (req, res) => {
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

    const result = db.prepare(`
        INSERT INTO products (name, category, price)
        VALUES (?, ?, ?)
    `).run(name.trim(), category.trim(), price);

    const product = db.prepare(
        'SELECT * FROM products WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json(product);
});

// Редактировать товар
app.put('/api/products/:id', (req, res) => {
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

    const result = db.prepare(`
        UPDATE products
        SET name = ?, category = ?, price = ?
        WHERE id = ?
    `).run(name.trim(), category.trim(), price, id);

    if (result.changes === 0) {
        return res.status(404).json({
            error: 'Товар не найден'
        });
    }

    const product = db.prepare(
        'SELECT * FROM products WHERE id = ?'
    ).get(id);

    res.json(product);
});

// Удалить товар
app.delete('/api/products/:id', (req, res) => {
    const id = Number(req.params.id);

    const result = db.prepare(
        'DELETE FROM products WHERE id = ?'
    ).run(id);

    if (result.changes === 0) {
        return res.status(404).json({
            error: 'Товар не найден'
        });
    }

    res.json({ message: 'Товар удалён' });
});

// Получить историю заказов
app.get('/api/orders', (req, res) => {
    const orders = db.prepare(`
        SELECT * FROM orders
        ORDER BY id DESC
    `).all();

    res.json(orders);
});

// Получить конкретный заказ с товарами
app.get('/api/orders/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Некорректный номер заказа'
        });
    }

    const order = db.prepare(
        'SELECT * FROM orders WHERE id = ?'
    ).get(id);

    if (!order) {
        return res.status(404).json({
            error: 'Заказ не найден'
        });
    }

    const items = db.prepare(`
        SELECT product_name, quantity, price
        FROM order_items
        WHERE order_id = ?
    `).all(id);

    res.json({ ...order, items });
});

// Оформить новый заказ
app.post('/api/orders', (req, res) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            error: 'Добавьте товары в заказ'
        });
    }

    try {
        const createOrder = db.transaction(() => {
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

                const product = db.prepare(
                    'SELECT * FROM products WHERE id = ?'
                ).get(productId);

                if (!product) {
                    throw new Error('Один из товаров не найден');
                }

                total += product.price * quantity;

                orderItems.push({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    quantity
                });
            }

            const orderResult = db.prepare(`
                INSERT INTO orders (total)
                VALUES (?)
            `).run(total);

            const orderId = Number(orderResult.lastInsertRowid);

            const insertItem = db.prepare(`
                INSERT INTO order_items
                (order_id, product_id, product_name, quantity, price)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const item of orderItems) {
                insertItem.run(
                    orderId,
                    item.productId,
                    item.name,
                    item.quantity,
                    item.price
                );
            }

            return orderId;
        });

        const orderId = createOrder();

        console.log('Оформлен заказ №', orderId);

        res.status(201).json({
            message: 'Заказ успешно оформлен',
            orderId
        });
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`CoffeeManager запущен: http://localhost:${PORT}`);
});
