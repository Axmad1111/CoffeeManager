
const productList = document.getElementById('productList');
const productForm = document.getElementById('productForm');

const nameInput = document.getElementById('name');
const categoryInput = document.getElementById('category');
const priceInput = document.getElementById('price');

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');

let editingProductId = null;
let allProducts = [];

// Загрузка товаров с сервера
async function loadProducts() {
    try {
        const response = await fetch('/api/products');

        if (!response.ok) {
            throw new Error('Не удалось загрузить товары');
        }

        allProducts = await response.json();

        updateCategoryFilter();
        renderProducts();

    } catch (error) {
        console.error(error);
        productList.textContent = 'Ошибка загрузки товаров';
    }
}

// Обновление списка категорий
function updateCategoryFilter() {
    const selectedCategory = categoryFilter.value;

    const categories = [
        ...new Set(allProducts.map(product => product.category))
    ].sort((a, b) => a.localeCompare(b, 'ru'));

    categoryFilter.innerHTML = '<option value="">Все категории</option>';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;

        categoryFilter.appendChild(option);
    });

    if (categories.includes(selectedCategory)) {
        categoryFilter.value = selectedCategory;
    }
}

// Отображение товаров
function renderProducts() {
    const searchText = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;
    const sortType = sortFilter.value;

    let filteredProducts = allProducts.filter(product => {
        const matchesName = product.name.toLowerCase()
            .includes(searchText);

        const matchesCategory = !selectedCategory ||
            product.category === selectedCategory;

        return matchesName && matchesCategory;
    });

    // Сортировка по цене
    if (sortType === 'asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortType === 'desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
    }

    productList.innerHTML = '';

    if (filteredProducts.length === 0) {
        productList.textContent = 'Товары не найдены.';
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'stat-card';

        const title = document.createElement('h3');
        title.textContent = product.name;

        const category = document.createElement('p');
        category.textContent = 'Категория: ' + product.category;

        const price = document.createElement('p');
        price.textContent = 'Цена: ' +
            Number(product.price).toFixed(2) + ' ₽';

        const editButton = document.createElement('button');
        editButton.textContent = 'Редактировать';

        editButton.addEventListener('click', () => {
            editProduct(product);
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Удалить';
        deleteButton.style.marginLeft = '8px';
        deleteButton.style.background = '#b94b45';

        deleteButton.addEventListener('click', () => {
            deleteProduct(product.id);
        });

        card.append(
            title,
            category,
            price,
            editButton,
            deleteButton
        );

        productList.appendChild(card);
    });
}

// Поиск и фильтры
searchInput.addEventListener('input', renderProducts);
categoryFilter.addEventListener('change', renderProducts);
sortFilter.addEventListener('change', renderProducts);

// Добавление и редактирование товара
productForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const product = {
        name: nameInput.value.trim(),
        category: categoryInput.value.trim(),
        price: Number(priceInput.value)
    };

    if (
        !product.name ||
        !product.category ||
        !Number.isFinite(product.price) ||
        product.price <= 0
    ) {
        alert('Заполните все поля правильно');
        return;
    }

    const isEditing = editingProductId !== null;

    const url = isEditing
        ? '/api/products/' + editingProductId
        : '/api/products';

    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(product)
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Не удалось сохранить товар');
            return;
        }

        productForm.reset();
        editingProductId = null;

        const submitButton = productForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.textContent = 'Добавить товар';

        await loadProducts();

        alert(isEditing
            ? 'Изменения сохранены!'
            : 'Товар добавлен!');

    } catch (error) {
        console.error(error);
        alert('Ошибка соединения с сервером');
    }
});

// Редактирование товара
function editProduct(product) {
    editingProductId = product.id;

    nameInput.value = product.name;
    categoryInput.value = product.category;
    priceInput.value = product.price;

    const submitButton = productForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.textContent = 'Сохранить изменения';

    productForm.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}

// Удаление товара
async function deleteProduct(id) {
    if (!confirm('Вы действительно хотите удалить этот товар?')) {
        return;
    }

    try {
        const response = await fetch('/api/products/' + id, {
            method: 'DELETE'
        });

        if (!response.ok) {
            alert('Не удалось удалить товар');
            return;
        }

        if (editingProductId === id) {
            productForm.reset();
            editingProductId = null;

            productForm.querySelector(
                'button[type="submit"]'
            ).textContent = 'Добавить товар';
        }

        await loadProducts();

    } catch (error) {
        console.error(error);
        alert('Ошибка соединения с сервером');
    }
}

// Первоначальная загрузка
loadProducts();
