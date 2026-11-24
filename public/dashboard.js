
const revenueElement = document.getElementById('revenue');
const orderCountElement = document.getElementById('orderCount');
const averageCheckElement = document.getElementById('averageCheck');
const popularProductElement = document.getElementById('popularProduct');

// Получаем статистику с сервера
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');

        if (!response.ok) {
            throw new Error('Ошибка загрузки статистики');
        }

        const data = await response.json();

        revenueElement.textContent =
            Number(data.revenue).toFixed(2) + ' ₽';

        orderCountElement.textContent =
            data.orderCount;

        averageCheckElement.textContent =
            Number(data.averageCheck).toFixed(2) + ' ₽';

        popularProductElement.textContent =
            data.popularProduct
                ? data.popularProduct.product_name
                : 'Нет данных';

    } catch (error) {
        console.error(error);
        alert('Не удалось загрузить статистику');
    }
}

// Запускаем загрузку статистики
loadDashboard();
