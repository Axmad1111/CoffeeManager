
const ordersList = document.getElementById('ordersList');
const orderDetails = document.getElementById('orderDetails');

const searchOrder = document.getElementById('searchOrder');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const minTotal = document.getElementById('minTotal');
const maxTotal = document.getElementById('maxTotal');

const filteredCount = document.getElementById('filteredCount');
const filteredRevenue = document.getElementById('filteredRevenue');

const resetFilters = document.getElementById('resetFilters');
const exportExcelButton = document.getElementById('exportExcelButton');

let allOrders = [];

// Форматирование денег
function formatMoney(value) {
    return Number(value).toFixed(2) + ' ₽';
}

// Загрузка истории заказов
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');

        if (!response.ok) {
            throw new Error('Не удалось загрузить историю заказов');
        }

        allOrders = await response.json();

        renderOrders();

    } catch (error) {
        console.error(error);
        ordersList.textContent = 'Ошибка загрузки заказов.';
    }
}

// Получение отфильтрованных заказов
function getFilteredOrders() {
    const orderNumber = searchOrder.value.trim();
    const from = dateFrom.value;
    const to = dateTo.value;
    const min = minTotal.value;
    const max = maxTotal.value;

    return allOrders.filter(order => {
        const orderDate = order.created_at.slice(0, 10);
        const orderTotal = Number(order.total);

        const matchesNumber =
            !orderNumber || String(order.id) === orderNumber;

        const matchesFrom =
            !from || orderDate >= from;

        const matchesTo =
            !to || orderDate <= to;

        const matchesMin =
            min === '' || orderTotal >= Number(min);

        const matchesMax =
            max === '' || orderTotal <= Number(max);

        return (
            matchesNumber &&
            matchesFrom &&
            matchesTo &&
            matchesMin &&
            matchesMax
        );
    });
}

// Отображение заказов
function renderOrders() {
    const filteredOrders = getFilteredOrders();

    const revenue = filteredOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0
    );

    filteredCount.textContent = filteredOrders.length;
    filteredRevenue.textContent = formatMoney(revenue);

    ordersList.innerHTML = '';

    if (filteredOrders.length === 0) {
        ordersList.textContent = 'Заказы не найдены.';
        return;
    }

    filteredOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.style.marginBottom = '12px';

        const title = document.createElement('h3');
        title.textContent = 'Заказ №' + order.id;

        const date = document.createElement('p');
        date.textContent = 'Дата: ' + order.created_at;

        const total = document.createElement('p');
        total.textContent = 'Сумма: ' + formatMoney(order.total);

        const button = document.createElement('button');
        button.textContent = 'Подробнее';

        button.addEventListener('click', () => {
            loadOrderDetails(order.id);
        });

        card.append(title, date, total, button);
        ordersList.appendChild(card);
    });
}

// Обработчики фильтров
searchOrder.addEventListener('input', renderOrders);
dateFrom.addEventListener('change', renderOrders);
dateTo.addEventListener('change', renderOrders);
minTotal.addEventListener('input', renderOrders);
maxTotal.addEventListener('input', renderOrders);

// Сброс фильтров
resetFilters.addEventListener('click', () => {
    searchOrder.value = '';
    dateFrom.value = '';
    dateTo.value = '';
    minTotal.value = '';
    maxTotal.value = '';

    renderOrders();
});

// Подробности конкретного заказа
async function loadOrderDetails(orderId) {
    try {
        const response = await fetch('/api/orders/' + orderId);

        if (!response.ok) {
            throw new Error('Не удалось загрузить заказ');
        }

        const order = await response.json();

        orderDetails.innerHTML = '';

        const title = document.createElement('h3');
        title.textContent = 'Заказ №' + order.id;

        const date = document.createElement('p');
        date.textContent = 'Дата оформления: ' + order.created_at;

        const heading = document.createElement('h4');
        heading.textContent = 'Состав заказа:';

        orderDetails.append(title, date, heading);

        order.items.forEach(item => {
            const row = document.createElement('p');

            const itemTotal = item.quantity * item.price;

            row.textContent =
                item.product_name +
                ' — ' + item.quantity +
                ' шт. × ' + formatMoney(item.price) +
                ' = ' + formatMoney(itemTotal);

            orderDetails.appendChild(row);
        });

        const total = document.createElement('h3');
        total.textContent = 'Итого: ' + formatMoney(order.total);

        orderDetails.appendChild(total);

        orderDetails.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

    } catch (error) {
        console.error(error);
        orderDetails.textContent =
            'Ошибка загрузки подробностей заказа.';
    }
}

// Подготовка значения для CSV
function escapeCSV(value) {
    let text = String(value ?? '');

    // Защита от интерпретации текста как формулы Excel
    if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
}

// Экспорт отчёта для Excel
async function exportToExcel() {
    const orders = getFilteredOrders();

    if (orders.length === 0) {
        alert('Нет заказов для экспорта.');
        return;
    }

    exportExcelButton.disabled = true;
    exportExcelButton.textContent = 'Подготовка отчёта...';

    try {
        const detailedOrders = await Promise.all(
            orders.map(async order => {
                const response = await fetch('/api/orders/' + order.id);

                if (!response.ok) {
                    throw new Error(
                        'Не удалось получить заказ №' + order.id
                    );
                }

                return await response.json();
            })
        );

        const rows = [];

        // Заголовки таблицы
        rows.push([
            'Номер заказа',
            'Дата оформления',
            'Название товара',
            'Количество',
            'Цена за единицу (руб.)',
            'Сумма позиции (руб.)',
            'Итого по заказу (руб.)'
        ]);

        // Данные заказов
        detailedOrders.forEach(order => {
            order.items.forEach(item => {
                rows.push([
                    order.id,
                    order.created_at,
                    item.product_name,
                    item.quantity,
                    Number(item.price).toFixed(2),
                    (item.quantity * item.price).toFixed(2),
                    Number(order.total).toFixed(2)
                ]);
            });
        });

        // Преобразование данных в CSV
        const csvContent = rows
            .map(row => row.map(escapeCSV).join(';'))
            .join('\r\n');

        // BOM нужен для корректного отображения русского текста в Excel
        const blob = new Blob(
            ['\uFEFF' + csvContent],
            { type: 'text/csv;charset=utf-8;' }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;

        const currentDate = new Date()
            .toISOString()
            .slice(0, 10);

        link.download = 'CoffeeManager_Report_' +
            currentDate + '.csv';

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        alert('Отчёт успешно сформирован!');

    } catch (error) {
        console.error(error);
        alert('Не удалось сформировать отчёт: ' + error.message);

    } finally {
        exportExcelButton.disabled = false;
        exportExcelButton.textContent = 'Скачать отчёт для Excel';
    }
}

// Кнопка экспорта
exportExcelButton.addEventListener('click', exportToExcel);

// Первоначальная загрузка
loadOrders();
