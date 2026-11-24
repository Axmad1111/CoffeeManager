
const todayElement = document.getElementById('todayRevenue');
const weekElement = document.getElementById('weekRevenue');
const monthElement = document.getElementById('monthRevenue');
const soldElement = document.getElementById('soldProducts');

const chartCanvas = document.getElementById('revenueChart');

let revenueChart = null;

// Форматирование денежных значений
function formatMoney(value) {
    return Number(value).toFixed(2) + ' ₽';
}

// Получение аналитики с сервера
async function loadAnalytics() {
    try {
        const response = await fetch('/api/analytics');

        if (!response.ok) {
            throw new Error('Не удалось загрузить аналитику');
        }

        const data = await response.json();

        // Вывод статистики
        todayElement.textContent = formatMoney(data.today);
        weekElement.textContent = formatMoney(data.week);
        monthElement.textContent = formatMoney(data.month);
        soldElement.textContent = data.soldProducts;

        // Подготавливаем данные для графика
        const labels = [];
        const values = [];

        // Создаём список последних семи дней
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            const dateKey = `${year}-${month}-${day}`;

            labels.push(
                date.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit'
                })
            );

            const dayData = data.dailyRevenue.find(
                item => item.day === dateKey
            );

            values.push(dayData ? dayData.revenue : 0);
        }

        // Удаляем старый график, если он уже существует
        if (revenueChart) {
            revenueChart.destroy();
        }

        // Создаём новый график
        revenueChart = new Chart(chartCanvas, {
            type: 'bar',

            data: {
                labels: labels,

                datasets: [{
                    label: 'Выручка (₽)',
                    data: values,
                    borderWidth: 1
                }]
            },

            options: {
                responsive: true,

                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error(error);
        alert('Ошибка загрузки аналитики');
    }
}

// Запускаем загрузку
loadAnalytics();
