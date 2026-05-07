version 1.0.0

./
├── client/                     # Frontend (React/JSX) 
│   ├── public/
│   │   └── assets/             # Зображення Marvel-персонажів (мін. 20) та аватари
│   ├── src/
│   │   ├── components/         # UI компоненти
│   │   │   ├── Auth/           # Система реєстрації та логіну 
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   └── RegisterForm.jsx
│   │   │   ├── Lobby/          # Кімнати для матчмейкінгу 
│   │   │   │   ├── RoomList.jsx   # Список публічних кімнат
│   │   │   │   ├── CreateRoom.jsx # Форма створення (Публічна/Приватна + пароль)
│   │   │   │   └── JoinRoom.jsx   # Перевірка пароля для приватних кімнат
│   │   │   ├── Battlefield/    # Ігрове поле 
│   │   │   │   ├── Board.jsx      # Поділ на зони гравця та опонента 
│   │   │   │   ├── PlayerZone.jsx # Нижня частина (аватар, нік, HP)
│   │   │   │   └── EnemyZone.jsx  # Верхня частина (аватар опонента)
│   │   │   ├── Card/           # Компонент картки 
│   │   │   │   # Поля: атака, захист, вартість, аліас 
│   │   │   │   └── MarvelCard.jsx 
│   │   │   └── UI/
│   │   │       ├── Timer.jsx      # Відлік 30 секунд на хід
│   │   │       └── CoinToss.jsx   # Візуалізація випадкового вибору черги
│   │   ├── App.jsx             # Керування станами (Lobby / Battle)
│   │   └── index.js
│   └── package.json
├── server/                     # Backend (Node.js)
│   ├── db/
│   │   └── connection.js       # Підключення до MySQL
│   ├── logic/
│   │   ├── gameEngine.js       # Логіка ходів, розрахунок HP, вибір першого ходу
│   │   └── matchmaking.js      # Управління кімнатами (створення, перевірка паролів)
│   ├── routes/                 # API для реєстрації та отримання карток
│   ├── sockets/                # Реальний час для матчів
│   └── server.js               # Точка входу
├── database/                   # Робота з даними
│   ├── init.sql                # Схема БД: Users, Rooms, MarvelCards (20+ записів)
│   └── seed_cards.sql          # Дані для 20 карток (атака, захист, cost)
├── docs/                       # Матеріали для захисту
│   ├── presentation.pdf        # Презентація продукту (7-10 хв)
│   └── demo_video.mp4          # Запис екрану (trailer) ігрового процесу
├── style_guides/               # Дотримання Google HTML/CSS & JS Style Guide
└── README.md                   # Опис проєкту та інструкція запуску