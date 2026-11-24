
const productList = document.getElementById('productList');
const cartList = document.getElementById('cartList');
const totalElement = document.getElementById('total');
const createOrderButton = document.getElementById('createOrderButton');

let products = [];
let cart = [];

// Загружаем товары из базы данных
async function loadProducts() {
    try {
        const response = await fetch('/api/products');

        if (!response.ok) {
            throw new Error('Ошибка загрузки меню');
        }

        products = await response.json();

        productList.innerHTML = '';

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.marginBottom = '12px';

            const name = document.createElement('h3');
            name.textContent = product.name;

            const price = document.createElement('p');
            price.textContent = 'Цена: ' + product.price + ' ₽';

            const button = document.createElement('button');
            button.textContent = 'Добавить в заказ';

            button.addEventListener('click', () => {
                addToCart(product.id);
            });

            card.append(name, price, button);
            productList.appendChild(card);
        });

        if (products.length === 0) {
            productList.textContent = 'В меню пока нет товаров.';
        }
    } catch (error) {
        console.error(error);
        productList.textContent = 'Не удалось загрузить меню.';
    }
}

// Добавление товара в корзину
function addToCart(productId) {
    const product = products.find(item => item.id === productId);

    if (!product) return;

    const existingItem = cart.find(item => item.productId === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    renderCart();
}

// Изменение количества товара
function changeQuantity(productId, change) {
    const item = cart.find(item => item.productId === productId);

    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        cart = cart.filter(item => item.productId !== productId);
    }

    renderCart();
}

// Отображение корзины
function renderCart() {
    cartList.innerHTML = '';

    if (cart.length === 0) {
        cartList.textContent = 'Корзина пока пуста.';
    }

    let total = 0;

    cart.forEach(item => {
        const row = document.createElement('div');
        row.style.marginBottom = '15px';

        const name = document.createElement('strong');
        name.textContent = item.name;

        const quantity = document.createElement('span');
        quantity.textContent = ' — ' + item.quantity + ' шт.';

        const sum = document.createElement('p');
        sum.textContent = 'Сумма: ' + (item.price * item.quantity) + ' ₽';

        const minusButton = document.createElement('button');
        minusButton.textContent = '−';
        minusButton.addEventListener('click', () => {
            changeQuantity(item.productId, -1);
        });

        const plusButton = document.createElement('button');
        plusButton.textContent = '+';
        plusButton.style.marginLeft = '8px';
        plusButton.addEventListener('click', () => {
            changeQuantity(item.productId, 1);
        });

        row.append(name, quantity, sum, minusButton, plusButton);
        cartList.appendChild(row);

        total += item.price * item.quantity;
    });

    totalElement.textContent = 'Итого: ' + total + ' ₽';
}

// Отправка заказа на сервер
async function createOrder() {
    if (cart.length === 0) {
        alert('Сначала добавьте товары в заказ');
        return;
    }

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                }))
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || 'Не удалось оформить заказ');
            return;
        }

        alert('Заказ №' + result.orderId + ' успешно оформлен!');

        cart = [];
        renderCart();
    } catch (error) {
        console.error(error);
        alert('Ошибка соединения с сервером');
    }
}

createOrderButton.addEventListener('click', createOrder);

// Запуск страницы
loadProducts();
renderCart();
