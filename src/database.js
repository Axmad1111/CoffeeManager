
const Database = require('better-sqlite3');
const path = require('path');

// Создаём или открываем базу данных
const db = new Database(
    path.join(__dirname, 'coffeemanager.db')
);

// Таблица товаров
db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL
    )
`);

// Таблица заказов
db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        total REAL NOT NULL
    )
`);

// Товары внутри заказов
db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
`);

// Добавляем начальные товары, если база пустая
const count = db.prepare(
    'SELECT COUNT(*) AS total FROM products'
).get();

if (count.total === 0) {
    const insert = db.prepare(`
        INSERT INTO products (name, category, price)
        VALUES (?, ?, ?)
    `);

    insert.run('Капучино', 'Кофе', 180);
    insert.run('Латте', 'Кофе', 200);
    insert.run('Чизкейк', 'Десерты', 250);

    console.log('Начальные товары добавлены!');
}

console.log('База данных CoffeeManager подключена!');

module.exports = db;
