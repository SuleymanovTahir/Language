# Деплой LinguaPlay на Vercel

Инструкция относится к этому проекту:

- Каталог: `/Users/tahir/Desktop/Language`
- Vercel scope: `suleymanovtahirs-projects`
- Vercel project: `language`
- Production URL: <https://language-iota-two.vercel.app>
- GitHub: <https://github.com/SuleymanovTahir/Language>
- База: Neon PostgreSQL, подключённая к проекту через Vercel Marketplace

## Настройка проекта

Локальная папка уже связана с правильным проектом через `.vercel/project.json`. Если связь понадобится восстановить:

```sh
cd /Users/tahir/Desktop/Language
npx vercel link --yes --scope suleymanovtahirs-projects --project language
```

В Vercel → Project Settings → Environment Variables должны быть заданы:

- `DATABASE_URL` — строка Neon PostgreSQL, подключённая для Production и Preview.
- `BETTER_AUTH_URL` — `https://language-iota-two.vercel.app`.
- `BETTER_AUTH_SECRET` — секрет Better Auth длиной не менее 32 символов.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — отправка подтверждений и сброса пароля. Для Gmail используйте пароль приложения, храните `SMTP_PASSWORD` как Secret.
- `LINGUAPLAY_OWNER_EMAIL` — `suleymanov.takhir@gmail.com`, адрес владельца этого проекта. Сборка проверяет это значение перед миграциями и назначает аккаунт после подтверждения email.

Не копируйте секреты в Git и не публикуйте `.env.local`. Шаблон локальных переменных находится в `.env.example`.

## Повторный Production-деплой

Запускайте команду из корня проекта, чтобы Vercel не взял другой каталог:

```sh
cd /Users/tahir/Desktop/Language
npx vercel deploy --prod --yes --scope suleymanovtahirs-projects
```

Команда использует уже привязанный проект `language`. Сборка запускает `scripts/vercel-build.mjs`: он применяет миграции Better Auth, собирает приложение и формирует API-функции Vercel. Миграции безопасно запускать повторно.

Preview деплой для проверки:

```sh
cd /Users/tahir/Desktop/Language
npx vercel deploy --yes --scope suleymanovtahirs-projects
```

Чтобы добавить или заменить пароль SMTP без его вывода в терминал, запустите `npx vercel env add SMTP_PASSWORD --environment production --scope suleymanovtahirs-projects` и введите значение в скрытом приглашении. После добавления переменных нужен новый Production-деплой.

Посмотреть статус и URL последних версий:

```sh
npx vercel list language --scope suleymanovtahirs-projects
```

## Первичный администратор

Начальная учётная запись администратора создаётся один раз при первичной настройке через переменные `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME` и `INITIAL_ADMIN_PASSWORD`. После сообщения `Admin user created successfully` эти три переменные нужно удалить из Preview и Production. Администратор и его пароль хранятся в Better Auth / Neon, а не в сборке приложения. Если пароль потерян, задайте новый через штатный сценарий смены/сброса пароля после входа либо восстановите учётную запись через защищённую админскую процедуру.

В дальнейшем не добавляйте `INITIAL_ADMIN_*` обратно без необходимости: команда создания пользователя нужна только для первоначального развёртывания.

## Проверки после деплоя

1. Откройте <https://language-iota-two.vercel.app> и убедитесь, что загрузился экран входа.
2. Войдите в личный кабинет и проверьте, что отображается ваш прогресс.
3. Создайте отдельного пользователя и убедитесь, что его прогресс начинается независимо.
4. Создайте тестовую игру, прикрепите аудио или изображение и откройте её по ссылке.
5. Проверьте добавление урока, загрузку вложения и повторный вход.
6. В админке проверьте список пользователей и их роли.

Если Preview-защита Vercel включена, превью URL попросит войти в Vercel; production-домен остаётся публичным. API синхронизации намеренно требует действующую сессию.

## Полезные файлы

- `vercel.json` — build command и дополнительные файлы API-функций.
- `scripts/vercel-build.mjs` — миграция Better Auth и сборка Vite.
- `api/` — API маршруты.
- `src/lib/auth.ts` — подключение Better Auth и PostgreSQL.
- `.env.example` — названия локальных переменных без секретных значений.
